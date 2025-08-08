import { Injectable } from '@nestjs/common';
import { CacheStrategyService } from './cache-strategy.service';
import { StructuredLoggerService } from '../logger/structured-logger.service';
import { ConfigService } from '@nestjs/config';

export interface CacheWarmupConfig {
  type: string;
  dataLoader: () => Promise<unknown[]>;
  keyExtractor: (item: unknown) => string;
  ttl?: number;
}

export interface CacheMetrics {
  totalKeys: number;
  memoryUsage: string;
  hitRate?: number;
  missRate?: number;
}

@Injectable()
export class CacheManagerService {
  constructor(
    private readonly cacheStrategy: CacheStrategyService,
    private readonly logger: StructuredLoggerService,
    private readonly configService: ConfigService,
  ) {
    this.logger.setContext({ module: 'CacheManagerService' });
  }

  /**
   * 批量预热缓存
   */
  async batchWarmup(configs: CacheWarmupConfig[]): Promise<void> {
    try {
      const warmupPromises = configs.map((config) => this.warmupCache(config));
      await Promise.all(warmupPromises);

      this.logger.log(
        `Batch cache warmup completed: configCount=${configs.length}, types=${JSON.stringify(configs.map((c) => c.type))}`,
      );
    } catch (error) {
      this.logger.error('Batch cache warmup failed', (error as Error).message);
      throw error;
    }
  }

  /**
   * 预热单个类型的缓存
   */
  private async warmupCache(config: CacheWarmupConfig): Promise<void> {
    try {
      const data = await config.dataLoader();
      const warmupPromises = data.map((item) => {
        const key = config.keyExtractor(item);
        return this.cacheStrategy.set(key, item, {
          type: config.type,
          ttl: config.ttl,
        });
      });

      await Promise.all(warmupPromises);

      this.logger.log(
        `Cache warmup completed: type=${config.type}, itemCount=${data.length}`,
      );
    } catch (error) {
      this.logger.error(
        `Cache warmup failed: type=${config.type}, error=${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * 获取缓存指标
   */
  async getCacheMetrics(): Promise<CacheMetrics> {
    try {
      // 委托给CacheStrategyService获取详细统计信息
      const stats = await this.cacheStrategy.getCacheStats();

      return {
        totalKeys: stats.keyCount || 0,
        memoryUsage: stats.memoryUsage
          ? `${(stats.memoryUsage * 100).toFixed(1)}%`
          : 'Unknown',
        hitRate: stats.hitRate,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get cache metrics: ${(error as Error).message}`,
      );
      return {
        totalKeys: 0,
        memoryUsage: 'Error',
      };
    }
  }

  /**
   * 清除过期缓存
   */
  async cleanupExpiredCache(): Promise<void> {
    try {
      // 委托给CacheStrategyService执行清理
      const beforeMetrics = await this.getCacheMetrics();

      // 触发CacheStrategyService的清理逻辑
      await this.cacheStrategy.performManualCleanup();

      const afterMetrics = await this.getCacheMetrics();

      this.logger.log(
        `Cache cleanup completed: beforeKeys=${beforeMetrics.totalKeys}, afterKeys=${afterMetrics.totalKeys}, cleaned=${beforeMetrics.totalKeys - afterMetrics.totalKeys}`,
      );
    } catch (error) {
      this.logger.error('Cache cleanup failed', (error as Error).message);
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: Record<string, unknown>;
  }> {
    try {
      // 委托给CacheStrategyService进行健康检查
      const healthStatus = await this.cacheStrategy.getHealthStatus();
      const metrics = await this.getCacheMetrics();

      return {
        status: healthStatus.status === 'healthy' ? 'healthy' : 'unhealthy',
        details: {
          ...healthStatus.details,
          metrics,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: (error as Error).message },
      };
    }
  }

  /**
   * 导出缓存配置
   */
  exportCacheConfig(): Record<string, unknown> {
    return {
      environment: this.configService.get<string>('NODE_ENV'),
      redis: {
        host: this.configService.get<string>('redis.host'),
        port: this.configService.get<number>('redis.port'),
        db: this.configService.get<number>('redis.db'),
      },
      cacheConfigs: Array.from(this.cacheStrategy.getCacheConfigs().entries()),
    };
  }

  /**
   * 批量删除缓存
   */
  async batchDelete(patterns: string[]): Promise<void> {
    try {
      // 委托给CacheStrategyService执行批量删除
      const deletePromises = patterns.map((pattern) =>
        this.cacheStrategy.clearCacheByPattern(pattern),
      );

      await Promise.all(deletePromises);

      this.logger.log(
        `Batch cache deletion completed: patterns=${JSON.stringify(patterns)}, patternCount=${patterns.length}`,
      );
    } catch (error) {
      this.logger.error(
        `Batch cache deletion failed: ${(error as Error).message}, Patterns: ${JSON.stringify(patterns)}`,
      );
      throw error;
    }
  }

  /**
   * 按标签清除缓存
   */
  async clearByTags(tags: string[]): Promise<void> {
    try {
      await this.cacheStrategy.clearByTags(tags);
      this.logger.log(`Cache cleared by tags: ${JSON.stringify(tags)}`);
    } catch (error) {
      this.logger.error(
        `Failed to clear cache by tags: ${(error as Error).message}, Tags: ${JSON.stringify(tags)}`,
      );
      throw error;
    }
  }

  /**
   * 按类型清除缓存
   */
  async clearByType(type: string): Promise<void> {
    try {
      const configs = this.cacheStrategy.getCacheConfigs();
      const config = configs.get(type);

      if (config) {
        await this.cacheStrategy.clearCacheByPattern(`${config.prefix}:*`);
        this.logger.log(`Cache cleared by type: ${type}`);
      } else {
        this.logger.warn(`Cache type not found: ${type}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to clear cache by type: ${(error as Error).message}, Type: ${type}`,
      );
      throw error;
    }
  }
}
