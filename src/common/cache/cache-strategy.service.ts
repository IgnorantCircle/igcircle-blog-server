import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';

export interface CacheConfig {
  ttl: number; // 缓存时间（秒）
  prefix: string; // 缓存前缀
  tags?: string[]; // 缓存标签，用于批量清除
}

export interface CacheOptions {
  ttl?: number; // 缓存时间（秒）
  type: string; // 缓存类型
}

@Injectable()
export class CacheStrategyService {
  private cacheConfigs: Map<string, CacheConfig> = new Map();

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {
    this.initializeCacheConfigs();
  }

  /**
   * 初始化缓存配置
   */
  private initializeCacheConfigs(): void {
    // 用户缓存配置
    this.cacheConfigs.set('user', {
      ttl: 300, // 5分钟
      prefix: 'user',
      tags: ['user', 'auth'],
    });

    // 文章缓存配置
    this.cacheConfigs.set('article', {
      ttl: 600, // 10分钟
      prefix: 'article',
      tags: ['article', 'content'],
    });

    // 分类缓存配置
    this.cacheConfigs.set('category', {
      ttl: 1800, // 30分钟
      prefix: 'category',
      tags: ['category', 'content'],
    });

    // 标签缓存配置
    this.cacheConfigs.set('tag', {
      ttl: 1800, // 30分钟
      prefix: 'tag',
      tags: ['tag', 'content'],
    });

    // 评论缓存配置
    this.cacheConfigs.set('comment', {
      ttl: 180, // 3分钟
      prefix: 'comment',
      tags: ['comment', 'content'],
    });

    // 统计数据缓存配置
    this.cacheConfigs.set('stats', {
      ttl: 3600, // 1小时
      prefix: 'stats',
      tags: ['stats'],
    });
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string, options: CacheOptions): Promise<T | null> {
    const config = this.getCacheConfig(options.type);
    const fullKey = this.buildKey(config.prefix, key);

    try {
      const value = await this.cacheManager.get<T>(fullKey);
      return value || null;
    } catch (error) {
      console.error(`Failed to get from cache: ${error}`);
      return null;
    }
  }

  /**
   * 设置缓存
   */
  async set<T>(key: string, value: T, options: CacheOptions): Promise<void> {
    const config = this.getCacheConfig(options.type);
    const fullKey = this.buildKey(config.prefix, key);
    const ttl = options.ttl || config.ttl;

    try {
      await this.cacheManager.set(fullKey, value, ttl * 1000); // 转换为毫秒
    } catch (error) {
      console.error(`Failed to set to cache: ${error}`);
    }
  }

  /**
   * 删除缓存
   */
  async del(key: string, options: CacheOptions): Promise<void> {
    const config = this.getCacheConfig(options.type);
    const fullKey = this.buildKey(config.prefix, key);

    try {
      await this.cacheManager.del(fullKey);
    } catch (error) {
      console.error(`Failed to delete from cache: ${error}`);
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
      console.log(`Cache warmed up for type: ${type}, items: ${data.length}`);
    } catch (error) {
      console.error(`Failed to warm up cache for type ${type}:`, error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    message: string;
  } {
    return {
      message: 'Single-node Redis cache active',
    };
  }

  /**
   * 获取缓存配置
   */
  private getCacheConfig(type: string): CacheConfig {
    const config = this.cacheConfigs.get(type);
    if (!config) {
      // 返回默认配置
      return {
        ttl: 300,
        prefix: type,
        tags: [type],
      };
    }
    return config;
  }

  /**
   * 构建缓存键
   */
  private buildKey(prefix: string, key: string): string {
    return `${prefix}:${key}`;
  }
}
