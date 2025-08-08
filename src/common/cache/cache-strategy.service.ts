import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { StructuredLoggerService } from '../logger/structured-logger.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CacheConfig,
  CacheStrategyConfig,
  DEFAULT_CACHE_CONFIGS,
  getEnvironmentCacheConfig,
  validateCacheConfig,
} from './cache.config';

export interface CacheOptions {
  type?: string;
  ttl?: number;
  tags?: string[];
  compress?: boolean;
  skipCache?: boolean;
}

@Injectable()
export class CacheStrategyService implements OnModuleInit {
  private cacheConfigs: Map<string, CacheConfig> = new Map();
  private strategyConfig: CacheStrategyConfig;
  private compressionEnabled: boolean = true;
  private monitoringEnabled: boolean = true;

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.setContext({ module: 'CacheStrategyService' });
  }

  async onModuleInit() {
    await this.initializeCacheConfigs();
    this.initializeStrategyConfig();
    this.startCleanupScheduler();
  }

  /**
   * 初始化缓存配置
   */
  private initializeCacheConfigs(): void {
    try {
      // 加载默认配置
      for (const [key, config] of Object.entries(DEFAULT_CACHE_CONFIGS)) {
        if (validateCacheConfig(config)) {
          this.cacheConfigs.set(key, config);
        } else {
          this.logger.warn(`Invalid cache config for key: ${key}`);
        }
      }

      // 加载自定义配置（如果有的话）
      const customConfigs = this.configService.get<Record<string, unknown>>('cache.configs');
      if (customConfigs) {
        for (const [key, config] of Object.entries(customConfigs)) {
          if (validateCacheConfig(config as CacheConfig)) {
            this.cacheConfigs.set(key, config as CacheConfig);
          }
        }
      }

      this.logger.log(
        `Cache configurations initialized: ${this.cacheConfigs.size} configs (${Array.from(this.cacheConfigs.keys()).join(', ')})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize cache configurations: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private initializeStrategyConfig(): void {
    const environment = this.configService.get<string>('NODE_ENV', 'development');
    this.strategyConfig = getEnvironmentCacheConfig(environment);

    this.compressionEnabled = this.strategyConfig.enableCompression;
    this.monitoringEnabled = this.strategyConfig.enableMonitoring;

    this.logger.log(
      `Cache strategy initialized: environment=${environment}, defaultTtl=${this.strategyConfig.defaultTtl}, keyPrefix=${this.strategyConfig.keyPrefix}, enableCompression=${this.strategyConfig.enableCompression}`,
    );
  }

  private startCleanupScheduler(): void {
    if (this.strategyConfig.cleanup.enabled) {
      setInterval(() => {
        this.performCleanup().catch((error) => {
          this.logger.error(
            `Scheduled cleanup failed: ${(error as Error).message}`,
          );
        });
      }, this.strategyConfig.cleanup.interval);

      this.logger.log(
        `Cache cleanup scheduler started: interval=${this.strategyConfig.cleanup.interval}ms`,
      );
    }
  }

  private async performCleanup(): Promise<void> {
    try {
      const stats = await this.getCacheStats();

      if (stats.memoryUsage && stats.memoryUsage > 0.8) {
        // 80% 内存使用率
        this.logger.warn(
          `High memory usage detected, performing cleanup: memoryUsage=${stats.memoryUsage}`,
        );

        // 清理过期的缓存
        await this.cleanupExpiredEntries();
      }
    } catch (error) {
      this.logger.error(
        `Cleanup performance check failed: ${(error as Error).message}`,
      );
    }
  }

  private async cleanupExpiredEntries(): Promise<void> {
    try {
      const redisClient = this.getRedisClient();
      if (!redisClient) {
        this.logger.warn('Redis client not available for cleanup');
        return;
      }

      let totalCleaned = 0;
      const cleanupStartTime = Date.now();

      // 获取内存使用情况
      const memoryInfo = await redisClient.info('memory');
      const memoryUsage = this.parseMemoryUsage(memoryInfo);
      const memoryPressure = memoryUsage > 0.8; // 80%以上认为内存压力大

      // 遍历所有缓存类型进行清理
      for (const [type, config] of this.cacheConfigs.entries()) {
        if (!config.enabled) continue;

        try {
          const pattern = `${config.prefix}:*`;
          const keys = await this.scanKeys(redisClient, pattern);

          if (keys.length === 0) continue;

          // 获取键的详细信息
          const keyInfos = await this.getKeysInfo(redisClient, keys);

          // 清理策略
          const toDelete: string[] = [];

          // 1. 清理已过期的键（Redis可能还没自动清理）
          const expiredKeys = keyInfos.filter((info) => info.ttl === -2);
          toDelete.push(...expiredKeys.map((info) => info.key));

          // 2. 如果内存压力大，清理即将过期的键（TTL < 60秒）
          if (memoryPressure) {
            const soonExpiredKeys = keyInfos.filter(
              (info) => info.ttl > 0 && info.ttl < 60,
            );
            toDelete.push(...soonExpiredKeys.map((info) => info.key));
          }

          // 3. LRU清理：如果键数量超过配置的最大值
          if (config.maxSize && keyInfos.length > config.maxSize) {
            const excessCount = keyInfos.length - config.maxSize;
            // 按访问时间排序，删除最久未访问的
            const sortedByAccess = keyInfos
              .filter((info) => !toDelete.includes(info.key))
              .sort((a, b) => (a.lastAccess || 0) - (b.lastAccess || 0))
              .slice(0, excessCount);
            toDelete.push(...sortedByAccess.map((info) => info.key));
          }

          // 4. 如果内存压力极大(>90%)，强制清理大对象
          if (memoryUsage > 0.9) {
            const largeObjects = keyInfos
              .filter(
                (info) => !toDelete.includes(info.key) && info.size > 10240,
              ) // >10KB
              .sort((a, b) => b.size - a.size)
              .slice(0, Math.min(10, keyInfos.length * 0.1)); // 最多清理10%
            toDelete.push(...largeObjects.map((info) => info.key));
          }

          // 批量删除
          if (toDelete.length > 0) {
            const pipeline = redisClient.pipeline();
            toDelete.forEach((key) => pipeline.del(key));
            await pipeline.exec();

            totalCleaned += toDelete.length;

            this.logger.log(
              `Cache cleanup completed for type ${type}: ${toDelete.length}/${keys.length} keys cleaned, memory usage: ${(memoryUsage * 100).toFixed(1)}%`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to cleanup cache type ${type}: ${(error as Error).message}`,
          );
        }
      }

      const cleanupDuration = Date.now() - cleanupStartTime;

      // 发送清理完成事件
      this.eventEmitter.emit('cache.cleanup.completed', {
        totalCleaned,
        duration: cleanupDuration,
        memoryUsage,
        timestamp: new Date(),
      });

      this.logger.log(
        `Cache cleanup completed: ${totalCleaned} keys cleaned in ${cleanupDuration}ms, memory usage: ${(memoryUsage * 100).toFixed(1)}%`,
      );
    } catch (error) {
      this.logger.error(`Cache cleanup failed: ${(error as Error).message}`);
    }
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string, options: CacheOptions): Promise<T | null> {
    const startTime = Date.now();

    try {
      if (options.skipCache) {
        return null;
      }

      const config = this.getCacheConfig(options.type || 'default');
      const fullKey = this.buildKey(config.prefix, key);

      const result = await this.cacheManager.get<string | T>(fullKey);

      if (result === null || result === undefined) {
        this.recordCacheEvent('miss', fullKey, Date.now() - startTime);
        return null;
      }

      // 处理压缩数据
      if (typeof result === 'string' && this.compressionEnabled) {
        try {
          const parsed = JSON.parse(result) as
            | { __compressed?: boolean; data?: string }
            | T;
          if (
            typeof parsed === 'object' &&
            parsed !== null &&
            '__compressed' in parsed &&
            parsed.__compressed
          ) {
            const decompressed = this.decompress(parsed.data as string);
            const finalResult = JSON.parse(decompressed) as T;
            this.recordCacheEvent('hit', fullKey, Date.now() - startTime);
            return finalResult;
          } else {
            this.recordCacheEvent('hit', fullKey, Date.now() - startTime);
            return parsed as T;
          }
        } catch (parseError) {
          // 如果解析失败，直接返回原始数据
          this.logger.warn(
          `Failed to parse cached data: key=${fullKey}, error=${(parseError as Error).message}`,
        );
        }
      }

      this.recordCacheEvent('hit', fullKey, Date.now() - startTime);
      return result as T;
    } catch (error) {
      this.logger.error(
        `Cache get error: ${(error as Error).message}, key=${key}, type=${options.type}`,
      );
      this.recordCacheEvent('error', key, Date.now() - startTime, error);
      return null;
    }
  }

  /**
   * 设置缓存
   */
  async set<T>(key: string, value: T, options: CacheOptions): Promise<void> {
    const startTime = Date.now();

    try {
      if (options.skipCache) {
        return;
      }

      const config = this.getCacheConfig(options.type || 'default');
      const fullKey = this.buildKey(config.prefix, key);
      const ttl = Math.min(
        options.ttl || config.ttl,
        this.strategyConfig.maxTtl,
      );

      let dataToStore: any = value;

      // 处理数据压缩
      if (this.compressionEnabled && options.compress !== false) {
        const serialized = JSON.stringify(value);
        const compressionThreshold =
          config.compressionThreshold ||
          this.strategyConfig.compressionThreshold;

        if (serialized.length > compressionThreshold) {
          const compressed = this.compress(serialized);
          dataToStore = JSON.stringify({
            __compressed: true,
            data: compressed,
            originalSize: serialized.length,
            compressedSize: compressed.length,
          });

          this.logger.debug(
            `Data compressed for cache: key=${fullKey}, originalSize=${serialized.length}, compressedSize=${compressed.length}, compressionRatio=${(compressed.length / serialized.length).toFixed(2)}`,
          );
        } else {
          dataToStore = serialized;
        }
      }

      await this.cacheManager.set(fullKey, dataToStore, ttl * 1000); // 转换为毫秒

      this.recordCacheEvent('set', fullKey, Date.now() - startTime);

      // 发送缓存设置事件
      if (this.monitoringEnabled) {
        this.eventEmitter.emit('cache.set', {
          key: fullKey,
          type: options.type,
          ttl,
          size:
            typeof dataToStore === 'string'
              ? dataToStore.length
              : JSON.stringify(dataToStore).length,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      this.logger.error(
        `Cache set error - Error: ${(error as Error).message}, Key: ${key}, Options: ${JSON.stringify(options)}`,
      );
      this.recordCacheEvent('error', key, Date.now() - startTime, error);
    }
  }

  /**
   * 删除缓存
   */
  async del(key: string, options: CacheOptions): Promise<void> {
    const startTime = Date.now();

    try {
      const config = this.getCacheConfig(options.type || 'default');
      const fullKey = this.buildKey(config.prefix, key);

      await this.cacheManager.del(fullKey);

      this.recordCacheEvent('delete', fullKey, Date.now() - startTime);

      // 发送缓存删除事件
      if (this.monitoringEnabled) {
        this.eventEmitter.emit('cache.delete', {
          key: fullKey,
          type: options.type,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      this.logger.error(
        `Cache delete error - Error: ${(error as Error).message}, Key: ${key}, Options: ${JSON.stringify(options)}`,
      );
      this.recordCacheEvent('error', key, Date.now() - startTime, error);
    }
  }

  /**
   * 根据标签清除缓存
   */
  async clearByTags(tags: string[]): Promise<void> {
    try {
      const clearPromises: Promise<void>[] = [];
      const matchedTypes: string[] = [];

      // 找到所有匹配标签的缓存类型
      for (const [type, config] of this.cacheConfigs.entries()) {
        const hasMatchingTag = tags.some((tag) => config.tags?.includes(tag));
        if (hasMatchingTag) {
          matchedTypes.push(type);
          // 清除该类型的所有缓存（通过前缀模式）
          clearPromises.push(this.clearCacheByPattern(`${config.prefix}:*`));
        }
      }

      await Promise.all(clearPromises);

      if (matchedTypes.length > 0) {
        this.logger.log(
        `Cleared cache for types: ${matchedTypes.join(', ')} with tags: ${tags.join(', ')}`,
      );
      }
    } catch (error) {
      this.logger.error(`Failed to clear cache by tags:`, error);
    }
  }

  /**
   * 预热缓存
   */
  async warmup(type: string, dataLoader: () => Promise<any[]>): Promise<void> {
    try {
      const data = await dataLoader();
      const config = this.getCacheConfig(type);
      const ttl = config.ttl;

      // 批量预热缓存
      const promises = data.map((item: any) => {
        const key = item.id;
        const fullKey = this.buildKey(config.prefix, key);
        return this.cacheManager.set(fullKey, item, ttl);
      });

      await Promise.all(promises);
      this.logger.log(`Cache warmed up for type: ${type}, items: ${data.length}`);
    } catch (error) {
      this.logger.error(`Failed to warm up cache for type ${type}:`, error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<{
    message: string;
    memoryUsage?: number;
    keyCount?: number;
    hitRate?: number;
  }> {
    try {
      const redisClient = (this.cacheManager as any).store?.client;

      if (redisClient && typeof redisClient.info === 'function') {
        const info = await redisClient.info('memory');
        const keyspace = await redisClient.info('keyspace');

        // 解析内存使用情况
        const memoryMatch = info.match(/used_memory:(\d+)/);
        const maxMemoryMatch = info.match(/maxmemory:(\d+)/);

        let memoryUsage: number | undefined;
        if (memoryMatch && maxMemoryMatch) {
          const usedMemory = parseInt(memoryMatch[1]);
          const maxMemory = parseInt(maxMemoryMatch[1]);
          memoryUsage = maxMemory > 0 ? usedMemory / maxMemory : undefined;
        }

        // 解析键数量
        const keyCountMatch = keyspace.match(/keys=(\d+)/);
        const keyCount = keyCountMatch ? parseInt(keyCountMatch[1]) : undefined;

        return {
          message: 'Redis cache active with detailed stats',
          memoryUsage,
          keyCount,
        };
      }

      return {
        message: 'Single-node Redis cache active',
      };
    } catch (error) {
      this.logger.error(
        `Failed to get cache stats: ${(error as Error).message}`,
      );
      return {
        message: 'Cache stats unavailable',
      };
    }
  }

  /**
   * 获取缓存配置
   */
  private getCacheConfig(type: string): CacheConfig {
    const config = this.cacheConfigs.get(type);
    if (!config) {
      // 返回默认配置
      return {
        type: 'default',
        ttl: 300,
        prefix: type,
        tags: [type],
        enabled: true,
      };
    }
    return config;
  }

  /**
   * 构建缓存键
   */
  private buildKey(prefix: string, key: string): string {
    const keyPrefix = this.strategyConfig?.keyPrefix || 'blog';
    return `${keyPrefix}:${prefix}:${key}`;
  }

  /**
   * 压缩数据
   */
  private compress(data: string): string {
    try {
      // 简单的压缩实现，实际项目中可以使用 zlib 或其他压缩库
      return Buffer.from(data).toString('base64');
    } catch (error) {
      this.logger.error(`Compression failed: ${(error as Error).message}`);
      return data;
    }
  }

  /**
   * 解压缩数据
   */
  private decompress(compressedData: string): string {
    try {
      return Buffer.from(compressedData, 'base64').toString('utf8');
    } catch (error) {
      this.logger.error(`Decompression failed: ${(error as Error).message}`);
      return compressedData;
    }
  }

  /**
   * 记录缓存事件
   */
  private recordCacheEvent(
    type: 'hit' | 'miss' | 'set' | 'delete' | 'error',
    key: string,
    executionTime: number,
    error?: unknown,
  ): void {
    if (!this.monitoringEnabled) {
      return;
    }

    // 采样记录，避免过多的监控数据
    if (Math.random() > this.strategyConfig.monitoringSampleRate) {
      return;
    }

    const event = {
      type,
      key,
      executionTime,
      timestamp: new Date(),
      error: error instanceof Error ? error.message : String(error),
    };

    this.eventEmitter.emit('cache.event', event);

    // 记录到日志
    if (type === 'error') {
      this.logger.error(
        `Cache operation error: ${event.type} - ${event.error}`,
      );
    } else {
      this.logger.debug(
        `Cache operation: ${event.type} - key=${event.key}, executionTime=${event.executionTime}ms`,
      );
    }
  }

  /**
   * 获取缓存配置列表
   */
  getCacheConfigs(): Map<string, CacheConfig> {
    return new Map(this.cacheConfigs);
  }

  /**
   * 更新缓存配置
   */
  updateCacheConfig(type: string, config: Partial<CacheConfig>): void {
    const existingConfig = this.cacheConfigs.get(type);
    if (existingConfig) {
      const updatedConfig = { ...existingConfig, ...config };
      if (validateCacheConfig(updatedConfig)) {
        this.cacheConfigs.set(type, updatedConfig);
        this.logger.log(`Cache config updated for type: ${type}`);
      } else {
        this.logger.error(`Invalid cache config update for type: ${type}`);
      }
    } else {
      this.logger.error(`Cache config not found for update: ${type}`);
    }
  }

  /**
   * 获取缓存健康状态
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, unknown>;
  }> {
    try {
      const testKey = 'health:check';
      const testValue = { timestamp: Date.now() };

      // 测试写入
      await this.set(testKey, testValue, { type: 'system', ttl: 10 });

      // 测试读取
      const result = await this.get(testKey, { type: 'system' });

      // 清理测试数据
      await this.del(testKey, { type: 'system' });

      if (result && (result as any).timestamp === testValue.timestamp) {
        return {
          status: 'healthy',
          details: {
            message: 'Cache is working properly',
            timestamp: new Date(),
          },
        };
      } else {
        return {
          status: 'degraded',
          details: {
            message: 'Cache read/write test failed',
            timestamp: new Date(),
          },
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          message: 'Cache health check failed',
          error: (error as Error).message || String(error),
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * 根据模式清除缓存
   * 使用Redis SCAN命令安全地删除匹配模式的键
   */
  async clearCacheByPattern(pattern: string): Promise<void> {
    try {
      // 获取底层的Redis客户端
      const redisClient = (this.cacheManager as any).store?.client;

      if (!redisClient || typeof redisClient.scanStream !== 'function') {
        this.logger.warn('Redis client not available or does not support SCAN');
        return;
      }

      const stream = redisClient.scanStream({
        match: pattern,
        count: 100, // 每次扫描的键数量
      });

      const keysToDelete: string[] = [];

      // 收集所有匹配的键
      for await (const keys of stream) {
        if (keys && (keys as string[]).length > 0) {
          keysToDelete.push(...(keys as string[]));
        }
      }

      // 批量删除键
      if (keysToDelete.length > 0) {
        // 分批删除，避免一次删除过多键
        const batchSize = 100;
        for (let i = 0; i < keysToDelete.length; i += batchSize) {
          const batch = keysToDelete.slice(i, i + batchSize);
          await (redisClient as Redis).del(...batch);
        }
        this.logger.log(
          `Deleted ${keysToDelete.length} cache keys matching pattern: ${pattern}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to clear cache by pattern ${pattern}:`, error);
      // 降级处理：尝试使用缓存管理器的reset方法（会清除所有缓存）
      // 在生产环境中可能不希望这样做
      if (this.configService.get('NODE_ENV') !== 'production') {
        this.logger.warn(
          'Falling back to cache reset due to pattern deletion failure',
        );
      }
    }
  }

  /**
   * 清除所有缓存
   * 谨慎使用，会清除Redis中的所有缓存数据
   */
  async clearAll(): Promise<void> {
    try {
      await (
        this.cacheManager as Cache & { reset: () => Promise<void> }
      ).reset();
      this.logger.log('All cache cleared');
    } catch (error) {
      this.logger.error('Failed to clear all cache:', error);
    }
  }

  /**
   * 手动触发缓存清理
   */
  async performManualCleanup(): Promise<void> {
    try {
      await this.cleanupExpiredEntries();
      this.logger.log('Manual cache cleanup completed');
    } catch (error) {
      this.logger.error(
        `Manual cache cleanup failed: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * 批量删除指定的缓存键
   */
  async delMultiple(keys: string[], options: CacheOptions): Promise<void> {
    try {
      const config = this.getCacheConfig(options.type || 'default');
      const fullKeys = keys.map((key) => this.buildKey(config.prefix, key));

      const redisClient = (this.cacheManager as any).store?.client as
        | Redis
        | undefined;
      if (redisClient && fullKeys.length > 0) {
        await redisClient.del(...fullKeys);
        this.logger.log(
          `Deleted ${fullKeys.length} cache keys for type: ${options.type}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to delete multiple cache keys:`, error);
    }
  }

  /**
   * 获取Redis客户端
   */
  private getRedisClient(): Redis | null {
    try {
      // 尝试从缓存管理器获取Redis客户端
      const store = (
        this.cacheManager as { store?: { getClient?: () => Redis } }
      ).store;
      if (store && store.getClient) {
        return store.getClient();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 扫描匹配模式的键
   */
  private async scanKeys(
    redisClient: Redis,
    pattern: string,
  ): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const result = await redisClient.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');

    return keys;
  }

  /**
   * 获取键的详细信息
   */
  private async getKeysInfo(
    redisClient: Redis,
    keys: string[],
  ): Promise<
    Array<{
      key: string;
      ttl: number;
      size: number;
      lastAccess?: number;
    }>
  > {
    if (keys.length === 0) return [];

    const pipeline = redisClient.pipeline();
    keys.forEach((key) => {
      pipeline.ttl(key);
      pipeline.memory('USAGE', key);
    });

    const results = await pipeline.exec();
    if (!results) return [];

    const keyInfos: Array<{
      key: string;
      ttl: number;
      size: number;
      lastAccess?: number;
    }> = [];

    for (let i = 0; i < keys.length; i++) {
      const ttlResult = results[i * 2];
      const sizeResult = results[i * 2 + 1];

      if (ttlResult && sizeResult && !ttlResult[0] && !sizeResult[0]) {
        keyInfos.push({
          key: keys[i],
          ttl: ttlResult[1] as number,
          size: sizeResult[1] as number,
          lastAccess: Date.now(), // 简化实现，实际可以通过OBJECT IDLETIME获取
        });
      }
    }

    return keyInfos;
  }

  /**
   * 解析内存使用情况
   */
  private parseMemoryUsage(memoryInfo: string): number {
    try {
      const usedMemoryMatch = memoryInfo.match(/used_memory:(\d+)/);
      const maxMemoryMatch = memoryInfo.match(/maxmemory:(\d+)/);

      if (usedMemoryMatch && maxMemoryMatch) {
        const usedMemory = parseInt(usedMemoryMatch[1]);
        const maxMemory = parseInt(maxMemoryMatch[1]);
        return maxMemory > 0 ? usedMemory / maxMemory : 0;
      }

      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * 解析连接数
   */
  private parseConnectionCount(info: string): number {
    try {
      const match = info.match(/connected_clients:(\d+)/);
      return match ? parseInt(match[1]) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * 解析命中率
   */
  private parseHitRate(stats: string): number {
    try {
      const hitsMatch = stats.match(/keyspace_hits:(\d+)/);
      const missesMatch = stats.match(/keyspace_misses:(\d+)/);

      if (hitsMatch && missesMatch) {
        const hits = parseInt(hitsMatch[1]);
        const misses = parseInt(missesMatch[1]);
        const total = hits + misses;
        return total > 0 ? hits / total : 0;
      }

      return 0;
    } catch {
      return 0;
    }
  }
}
