import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { BlogCacheService } from '@/common/cache/blog-cache.service';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';

export interface CacheItem {
  key: string;
  value: unknown;
  size: number;
  ttl?: number;
  type: string;
  createdAt?: string;
}

export interface CacheOverview {
  totalKeys: number;
  totalSize: number;
  categories: {
    articles: number;
    tags: number;
    categories: number;
    users: number;
    tokens: number;
    other: number;
  };
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
}

type CategoryKey =
  | 'articles'
  | 'tags'
  | 'categories'
  | 'users'
  | 'tokens'
  | 'other';

/**
 * 开发环境缓存服务
 * 提供缓存数据的查看、管理功能
 */
@Injectable()
export class DevCacheService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly blogCacheService: BlogCacheService,
    private readonly logger: StructuredLoggerService,
  ) {}

  /**
   * 获取缓存概览
   */
  async getCacheOverview(): Promise<CacheOverview> {
    try {
      const keys = await this.getAllCacheKeysInternal();
      const categories = this.categorizeKeys(keys);
      const memoryUsage = this.getMemoryUsage();

      let totalSize = 0;
      for (const key of keys) {
        const data = await this.cache.get(key);
        if (data) {
          totalSize += this.calculateSize(data);
        }
      }

      return {
        totalKeys: keys.length,
        totalSize,
        categories,
        memoryUsage,
      };
    } catch (error) {
      this.logger.error('获取缓存概览失败', error);
      throw error;
    }
  }

  /**
   * 获取所有缓存键
   */
  async getAllCacheKeys(pattern?: string): Promise<string[]> {
    try {
      const keys = await this.getAllCacheKeysInternal();

      if (pattern) {
        const regex = new RegExp(pattern, 'i');
        return keys.filter((key) => regex.test(key));
      }

      return keys;
    } catch (error) {
      this.logger.error('获取缓存键失败', error);
      throw error;
    }
  }

  /**
   * 获取指定缓存数据
   */
  async getCacheData(key: string): Promise<CacheItem | null> {
    try {
      const value = await this.cache.get(key);

      if (value === undefined || value === null) {
        return null;
      }

      let parsedValue;
      try {
        parsedValue = typeof value === 'string' ? JSON.parse(value) : value;
      } catch {
        parsedValue = value;
      }

      return {
        key,
        value: parsedValue,
        size: this.calculateSize(value),
        type: this.getDataType(parsedValue),
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`获取缓存数据失败: ${key}`, error);
      throw error;
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<Record<string, unknown>> {
    try {
      const keys = await this.getAllCacheKeysInternal();
      const stats = {
        totalKeys: keys.length,
        keysByCategory: this.categorizeKeys(keys),
        sizeByCategory: {} as Record<string, number>,
        recentActivity: [],
        topKeys: [],
      };

      // 计算各分类的大小
      for (const [category, count] of Object.entries(stats.keysByCategory)) {
        const categoryKeys = keys.filter(
          (key) => this.getCategoryByKey(key) === category,
        );
        let categorySize = 0;

        for (const key of categoryKeys) {
          const data = await this.cache.get(key);
          if (data) {
            categorySize += this.calculateSize(data);
          }
        }

        stats.sizeByCategory[category] = categorySize;
      }

      return stats;
    } catch (error) {
      this.logger.error('获取缓存统计失败', error);
      throw error;
    }
  }

  /**
   * 清除指定缓存
   */
  async clearCache(
    key: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.cache.del(key);
      this.logger.debug(`缓存已清除: ${key}`);

      return {
        success: true,
        message: `缓存 ${key} 已清除`,
      };
    } catch (error) {
      this.logger.error(`清除缓存失败: ${key}`, error);
      return {
        success: false,
        message: `清除缓存失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 清除所有缓存
   */
  async clearAllCache(): Promise<{ success: boolean; message: string }> {
    try {
      await this.blogCacheService.clearAllCache();
      this.logger.debug('所有缓存已清除');

      return {
        success: true,
        message: '所有缓存已清除',
      };
    } catch (error) {
      this.logger.error('清除所有缓存失败', error);
      return {
        success: false,
        message: `清除所有缓存失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 获取内存使用情况
   */
  getMemoryUsage(): { used: number; total: number; percentage: number } {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    const usedMemory = memUsage.heapUsed;

    return {
      used: usedMemory,
      total: totalMemory,
      percentage: Math.round((usedMemory / totalMemory) * 100),
    };
  }

  // 私有方法
  private async getAllCacheKeysInternal(): Promise<string[]> {
    const keys: string[] = [];

    // 检查已知的固定键
    const fixedKeys = [
      'blog:articles:featured',
      'blog:articles:top',
      'blog:articles:popular',
      'blog:articles:recent',
      'blog:tags:all',
      'blog:categories:all',
    ];

    for (const key of fixedKeys) {
      const value = await this.cache.get(key);
      if (value !== undefined && value !== null) {
        keys.push(key);
      }
    }

    // 检查分页的文章列表缓存
    for (let page = 1; page <= 10; page++) {
      for (const limit of [10, 20, 50]) {
        const key = `blog:articles:list:${page}:${limit}`;
        const value = await this.cache.get(key);
        if (value !== undefined && value !== null) {
          keys.push(key);
        }
      }
    }

    return keys;
  }

  private categorizeKeys(keys: string[]): Record<CategoryKey, number> {
    const categories = {
      articles: 0,
      tags: 0,
      categories: 0,
      users: 0,
      tokens: 0,
      other: 0,
    };

    keys.forEach((key) => {
      const category = this.getCategoryByKey(key);
      categories[category]++;
    });

    return categories;
  }

  private getCategoryByKey(key: string): CategoryKey {
    if (key.includes('articles') || key.includes('article:')) {
      return 'articles';
    }
    if (key.includes('tags')) {
      return 'tags';
    }
    if (key.includes('categories')) {
      return 'categories';
    }
    if (key.includes('user:token')) {
      return 'tokens';
    }
    if (key.includes('user:')) {
      return 'users';
    }
    return 'other';
  }

  private calculateSize(data: unknown): number {
    if (data === null || data === undefined) {
      return 0;
    }

    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return new Blob([str]).size;
  }

  private getDataType(data: unknown): string {
    if (Array.isArray(data)) {
      return `Array[${data.length}]`;
    }
    if (typeof data === 'object' && data !== null) {
      return `Object{${Object.keys(data as Record<string, unknown>).length}}`;
    }
    return typeof data;
  }
}
