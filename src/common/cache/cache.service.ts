import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { StructuredLoggerService } from '../logger/structured-logger.service';
import { BaseCacheOptions } from '../interfaces/cache.interface';
import { getCacheTTL, CacheType } from './cache.config';

/**
 * 核心的缓存功能：get、set、del、clearByType
 */
@Injectable()
export class CacheService {
  private readonly keyPrefix = 'blog';

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext({ module: 'CacheService' });
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string, options?: BaseCacheOptions): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key, options?.type);
      const result = await this.cacheManager.get<T>(fullKey);
      return result || null;
    } catch (error) {
      this.logger.warn(
        `Failed to get cache for key ${key}: ${(error as Error).message}`,
        {
          metadata: {
            key,
            type: options?.type,
            operation: 'get',
            error: (error as Error).message,
          },
        },
      );
      // 缓存失败时返回null，不影响业务逻辑
      return null;
    }
  }

  /**
   * 设置缓存
   */
  async set<T>(
    key: string,
    value: T,
    options?: BaseCacheOptions,
  ): Promise<void> {
    try {
      const fullKey = this.buildKey(key, options?.type);
      const cacheType = (options?.type as CacheType) || 'temp';
      const ttl = getCacheTTL(cacheType, options?.ttl) * 1000; // 转换为毫秒
      await this.cacheManager.set(fullKey, value, ttl);
    } catch (error) {
      this.logger.warn(
        `Failed to set cache for key ${key}: ${(error as Error).message}`,
        {
          metadata: {
            key,
            type: options?.type,
            operation: 'set',
            error: (error as Error).message,
          },
        },
      );
      // 缓存失败时不抛出错误，允许业务继续执行
    }
  }

  /**
   * 删除缓存
   */
  async del(key: string, options?: BaseCacheOptions): Promise<void> {
    try {
      const fullKey = this.buildKey(key, options?.type);
      await this.cacheManager.del(fullKey);
    } catch (error) {
      this.logger.warn(
        `Failed to delete cache for key ${key}: ${(error as Error).message}`,
        {
          metadata: {
            key,
            type: options?.type,
            operation: 'del',
            error: (error as Error).message,
          },
        },
      );
      // 缓存删除失败时不抛出错误
    }
  }

  /**
   * 清除指定类型的所有缓存
   */
  async clearByType(type: string): Promise<void> {
    const pattern = `${this.keyPrefix}:${type}:*`;
    await this.clearCacheByPattern(pattern);
    this.logger.log(`Cleared cache by type: ${type}`, {
      metadata: { type, operation: 'clearByType' },
    });
  }

  async clearCacheByPattern(pattern: string): Promise<void> {
    try {
      this.logger.log(`Clearing cache by pattern: ${pattern}`, {
        metadata: { pattern, operation: 'clearByPattern' },
      });

      // 检查是否有多store配置
      interface CacheManagerWithStores {
        stores?: unknown[];
        store?: unknown;
      }

      const cacheManager = this.cacheManager as CacheManagerWithStores;

      if (cacheManager.stores && cacheManager.stores.length > 0) {
        // 多store配置，获取Redis store
        const redisStore = cacheManager.stores[0];
        await this.clearRedisPattern(redisStore, pattern);
      } else if (cacheManager.store) {
        // 单store配置
        await this.clearRedisPattern(cacheManager.store, pattern);
      } else {
        // 直接使用cacheManager
        await this.clearRedisPattern(cacheManager, pattern);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to clear cache by pattern ${pattern}, skipping pattern clearing: ${(error as Error).message}`,
        {
          metadata: {
            pattern,
            operation: 'clearByPattern',
            error: (error as Error).message,
          },
        },
      );
      // 不抛出错误，允许业务继续执行
    }
  }

  private async clearRedisPattern(
    store: unknown,
    pattern: string,
  ): Promise<void> {
    try {
      interface RedisClient {
        scan?: (
          cursor: string,
          ...args: (string | number)[]
        ) => Promise<[string, string[]]>;
        del?: (...keys: string[]) => Promise<number>;
        unlink?: (...keys: string[]) => Promise<number>;
      }

      interface RedisStore {
        client?: RedisClient;
        getClient?: () => Promise<RedisClient> | RedisClient;
        redis?: RedisClient;
      }

      const keys: string[] = [];
      let cursor = '0';

      // 尝试不同的Redis客户端访问方式
      let redisClient: RedisClient = store as RedisClient;
      const redisStore = store as RedisStore;

      // 如果store有client属性，使用client
      if (redisStore.client) {
        redisClient = redisStore.client;
      }
      // 如果store有getClient方法，调用获取client
      else if (typeof redisStore.getClient === 'function') {
        redisClient = await redisStore.getClient();
      }
      // 如果store有redis属性，使用redis
      else if (redisStore.redis) {
        redisClient = redisStore.redis;
      }

      do {
        const result = await redisClient.scan!(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');

      // 批量删除匹配的键
      if (keys.length > 0) {
        if (typeof redisClient.del === 'function') {
          await redisClient.del(...keys);
        } else if (typeof redisClient.unlink === 'function') {
          await redisClient.unlink(...keys);
        } else {
          // 逐个删除
          for (const key of keys) {
            await this.cacheManager.del(key);
          }
        }
        this.logger.log(
          `Cleared ${keys.length} cache keys matching pattern: ${pattern}`,
          {
            metadata: {
              pattern,
              keysCount: keys.length,
              operation: 'clearRedisPattern',
            },
          },
        );
      } else {
        this.logger.log(`No cache keys found matching pattern: ${pattern}`, {
          metadata: { pattern, operation: 'clearRedisPattern' },
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to clear Redis pattern ${pattern}: ${(error as Error).message}`,
        error instanceof Error ? error.stack : undefined,
        { metadata: { pattern, operation: 'clearRedisPattern' } },
      );
      throw error;
    }
  }

  /**
   * 构建缓存键
   */
  private buildKey(key: string, type?: string): string {
    const cacheType = type || 'temp';
    return `${this.keyPrefix}:${cacheType}:${key}`;
  }
}
