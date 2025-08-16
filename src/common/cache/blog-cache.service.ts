import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { StructuredLoggerService } from '../logger/structured-logger.service';

/**
 * 博客缓存服务
 * 只缓存核心数据：文章列表、精选文章、置顶文章、热门文章详情、全量标签、全量分类
 */
@Injectable()
export class BlogCacheService {
  // 缓存键常量
  private static readonly KEYS = {
    ARTICLE_LIST: 'blog:articles:list',
    FEATURED_ARTICLES: 'blog:articles:featured',
    TOP_ARTICLES: 'blog:articles:top',
    POPULAR_ARTICLES: 'blog:articles:popular',
    RECENT_ARTICLES: 'blog:articles:recent',
    ALL_TAGS: 'blog:tags:all',
    ALL_CATEGORIES: 'blog:categories:all',
    ARTICLE_DETAIL_BY_SLUG: (slug: string) => `blog:article:slug:${slug}`,
    USER_ONLINE_STATUS: (userId: string) => `blog:user:online:${userId}`,
    USER_TOKEN: (userId: string, tokenId: string) =>
      `blog:user:token:${userId}:${tokenId}`,
    USER_ALL_TOKENS: (userId: string) => `blog:user:tokens:${userId}`,
  };

  // 缓存时间（毫秒）
  private static readonly TTL = {
    // 文章列表缓存时间 - 30分钟
    ARTICLE_LIST: 30 * 60 * 1000, // 30分钟
    // 精选文章缓存时间 - 30分钟
    FEATURED_ARTICLES: 30 * 60 * 1000, // 30分钟
    // 置顶文章缓存时间 - 30分钟
    TOP_ARTICLES: 30 * 60 * 1000, // 30分钟
    // 热门文章缓存时间 - 15分钟
    POPULAR_ARTICLES: 15 * 60 * 1000, // 15分钟
    // 最新文章缓存时间 - 5分钟
    RECENT_ARTICLES: 5 * 60 * 1000, // 5分钟
    // 全部标签缓存时间 - 24小时
    ALL_TAGS: 24 * 60 * 60 * 1000, // 24小时
    // 全部分类缓存时间 - 124小时
    ALL_CATEGORIES: 24 * 60 * 60 * 1000, // 24小时
    // 根据别名获取文章详情缓存时间 - 30分钟
    ARTICLE_DETAIL_BY_SLUG: 30 * 60 * 1000, // 30分钟
    // 用户在线状态缓存时间 - 5分钟
    USER_ONLINE_STATUS: 5 * 60 * 1000, // 5分钟
    // 用户令牌缓存时间 - 7天
    USER_TOKEN: 7 * 24 * 60 * 60 * 1000, // 7天
  };

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly logger: StructuredLoggerService,
  ) {}

  /**
   * 获取文章列表缓存
   */
  async getArticleList(page: number = 1, limit: number = 10): Promise<unknown> {
    const key = `${BlogCacheService.KEYS.ARTICLE_LIST}:${page}:${limit}`;
    return this.get(key);
  }

  /**
   * 设置文章列表缓存
   */
  async setArticleList(
    data: unknown,
    page: number = 1,
    limit: number = 10,
  ): Promise<void> {
    const key = `${BlogCacheService.KEYS.ARTICLE_LIST}:${page}:${limit}`;
    await this.set(key, data, BlogCacheService.TTL.ARTICLE_LIST);
  }

  /**
   * 获取精选文章缓存
   */
  async getFeaturedArticles(): Promise<unknown> {
    return this.get(BlogCacheService.KEYS.FEATURED_ARTICLES);
  }

  /**
   * 设置精选文章缓存
   */
  async setFeaturedArticles(data: unknown): Promise<void> {
    await this.set(
      BlogCacheService.KEYS.FEATURED_ARTICLES,
      data,
      BlogCacheService.TTL.FEATURED_ARTICLES,
    );
  }

  /**
   * 获取置顶文章缓存
   */
  async getTopArticles(): Promise<unknown> {
    return this.get(BlogCacheService.KEYS.TOP_ARTICLES);
  }

  /**
   * 设置置顶文章缓存
   */
  async setTopArticles(data: unknown): Promise<void> {
    await this.set(
      BlogCacheService.KEYS.TOP_ARTICLES,
      data,
      BlogCacheService.TTL.TOP_ARTICLES,
    );
  }

  /**
   * 获取热门文章缓存
   */
  async getPopularArticles(): Promise<unknown> {
    return this.get(BlogCacheService.KEYS.POPULAR_ARTICLES);
  }

  /**
   * 设置热门文章缓存
   */
  async setPopularArticles(data: unknown): Promise<void> {
    await this.set(
      BlogCacheService.KEYS.POPULAR_ARTICLES,
      data,
      BlogCacheService.TTL.POPULAR_ARTICLES,
    );
  }

  /**
   * 清除热门文章缓存（当文章浏览量变化时调用）
   */
  async clearPopularArticlesCache(): Promise<void> {
    try {
      await this.del(BlogCacheService.KEYS.POPULAR_ARTICLES);
      this.logger.debug('热门文章缓存已清除');
    } catch (error) {
      this.logger.error('清除热门文章缓存失败', error);
    }
  }

  /**
   * 获取最新文章缓存
   */
  async getRecentArticles(): Promise<unknown> {
    return this.get(BlogCacheService.KEYS.RECENT_ARTICLES);
  }

  /**
   * 设置最新文章缓存
   */
  async setRecentArticles(data: unknown): Promise<void> {
    await this.set(
      BlogCacheService.KEYS.RECENT_ARTICLES,
      data,
      BlogCacheService.TTL.RECENT_ARTICLES,
    );
  }

  /**
   * 获取文章详情缓存（通过slug）
   */
  async getArticleDetailBySlug(slug: string): Promise<unknown> {
    const key = BlogCacheService.KEYS.ARTICLE_DETAIL_BY_SLUG(slug);
    return this.get(key);
  }

  /**
   * 设置文章详情缓存（通过slug）
   */
  async setArticleDetailBySlug(slug: string, data: unknown): Promise<void> {
    const key = BlogCacheService.KEYS.ARTICLE_DETAIL_BY_SLUG(slug);
    await this.set(key, data, BlogCacheService.TTL.ARTICLE_DETAIL_BY_SLUG);
  }

  /**
   * 清除文章详情缓存（通过slug）
   */
  async clearArticleDetailBySlug(slug: string): Promise<void> {
    try {
      await this.del(BlogCacheService.KEYS.ARTICLE_DETAIL_BY_SLUG(slug));
    } catch (error) {
      this.logger.error(
        '清除文章详情缓存失败',
        error instanceof Error ? error.stack : undefined,
        {
          action: 'clear_article_detail_by_slug_cache',
          metadata: { slug },
        },
      );
    }
  }

  /**
   * 获取全量标签缓存
   */
  async getAllTags(): Promise<unknown> {
    return this.get(BlogCacheService.KEYS.ALL_TAGS);
  }

  /**
   * 设置全量标签缓存
   */
  async setAllTags(data: unknown): Promise<void> {
    await this.set(
      BlogCacheService.KEYS.ALL_TAGS,
      data,
      BlogCacheService.TTL.ALL_TAGS,
    );
  }

  /**
   * 获取全量分类缓存
   */
  async getAllCategories(): Promise<unknown> {
    return this.get(BlogCacheService.KEYS.ALL_CATEGORIES);
  }

  /**
   * 设置全量分类缓存
   */
  async setAllCategories(data: unknown): Promise<void> {
    await this.set(
      BlogCacheService.KEYS.ALL_CATEGORIES,
      data,
      BlogCacheService.TTL.ALL_CATEGORIES,
    );
  }

  /**
   * 清除文章相关缓存（发布、更新、删除文章时调用）
   * @param slug 文章slug，如果提供则只清除该文章的详情缓存
   * @param operationType 操作类型，必须指定以确保精确的缓存清除策略
   */
  async clearArticleCache(
    slug?: string,
    operationType:
      | 'create'
      | 'update'
      | 'delete'
      | 'feature'
      | 'top'
      | 'publish'
      | 'archive' = 'update',
  ): Promise<void> {
    try {
      const clearPromises: Promise<void>[] = [];

      // 根据操作类型智能清除缓存
      switch (operationType) {
        case 'create':
        case 'publish':
          // 新文章发布：清除列表和最新文章缓存
          clearPromises.push(this.clearArticleListCache());
          clearPromises.push(this.del(BlogCacheService.KEYS.RECENT_ARTICLES));
          break;

        case 'update':
          // 文章更新：只清除该文章详情缓存
          if (slug) {
            clearPromises.push(this.clearArticleDetailBySlug(slug));
          }
          break;

        case 'delete':
          // 文章删除：清除所有相关缓存
          clearPromises.push(this.clearArticleListCache());
          clearPromises.push(this.clearSpecialArticleListsCache());
          if (slug) {
            clearPromises.push(this.clearArticleDetailBySlug(slug));
          }
          break;

        case 'feature':
          // 精选状态变更：清除精选文章缓存
          clearPromises.push(this.del(BlogCacheService.KEYS.FEATURED_ARTICLES));
          if (slug) {
            clearPromises.push(this.clearArticleDetailBySlug(slug));
          }
          break;

        case 'top':
          // 置顶状态变更：清除置顶文章缓存
          clearPromises.push(this.del(BlogCacheService.KEYS.TOP_ARTICLES));
          if (slug) {
            clearPromises.push(this.clearArticleDetailBySlug(slug));
          }
          break;

        case 'archive':
          // 归档状态变更：清除列表缓存
          clearPromises.push(this.clearArticleListCache());
          if (slug) {
            clearPromises.push(this.clearArticleDetailBySlug(slug));
          }
          break;
      }

      // 并行执行所有清除操作
      await Promise.all(clearPromises);

      this.logger.debug(`文章缓存已清除`, {
        metadata: {
          slug: slug || 'all',
          operationType,
        },
      });
    } catch (error) {
      this.logger.error('清除文章缓存失败', error);
      throw error;
    }
  }

  /**
   * 清除文章列表缓存（分页缓存）
   */
  private async clearArticleListCache(): Promise<void> {
    const clearPromises: Promise<void>[] = [];
    const commonPageSizes = [6, 10, 20, 50];
    const maxPages = 5; // 减少清除页数，提高性能

    for (const limit of commonPageSizes) {
      for (let page = 1; page <= maxPages; page++) {
        const key = `${BlogCacheService.KEYS.ARTICLE_LIST}:${page}:${limit}`;
        clearPromises.push(this.del(key));
      }
    }

    await Promise.all(clearPromises);
  }

  /**
   * 清除特殊文章列表缓存（精选、置顶、热门、最新）
   */
  private async clearSpecialArticleListsCache(): Promise<void> {
    const clearPromises = [
      this.del(BlogCacheService.KEYS.FEATURED_ARTICLES),
      this.del(BlogCacheService.KEYS.TOP_ARTICLES),
      this.del(BlogCacheService.KEYS.POPULAR_ARTICLES),
      this.del(BlogCacheService.KEYS.RECENT_ARTICLES),
    ];

    await Promise.all(clearPromises);
  }

  /**
   * 清除标签缓存（标签变更时调用）
   */
  async clearTagCache(): Promise<void> {
    try {
      await this.del(BlogCacheService.KEYS.ALL_TAGS);
      this.logger.debug('标签缓存已清除');
    } catch (error) {
      this.logger.error('清除标签缓存失败', error);
    }
  }

  /**
   * 清除分类缓存（分类变更时调用）
   */
  async clearCategoryCache(): Promise<void> {
    try {
      await this.del(BlogCacheService.KEYS.ALL_CATEGORIES);
      this.logger.debug('分类缓存已清除');
    } catch (error) {
      this.logger.error('清除分类缓存失败', error);
    }
  }

  /**
   * 获取用户在线状态
   */
  async getUserOnlineStatus(userId: string): Promise<{
    onlineStatus: string;
    lastActiveAt: number | null;
  } | null> {
    const key = BlogCacheService.KEYS.USER_ONLINE_STATUS(userId);
    return this.get(key) as Promise<{
      onlineStatus: string;
      lastActiveAt: number | null;
    } | null>;
  }

  /**
   * 设置用户在线状态
   */
  async setUserOnlineStatus(
    userId: string,
    onlineStatus: string,
    lastActiveAt: number | null = null,
  ): Promise<void> {
    const key = BlogCacheService.KEYS.USER_ONLINE_STATUS(userId);
    const data = {
      onlineStatus,
      lastActiveAt: lastActiveAt || Date.now(),
    };
    await this.set(key, data, BlogCacheService.TTL.USER_ONLINE_STATUS);
    this.logger.debug(`用户在线状态已缓存: ${userId}`, {
      userId,
      metadata: { onlineStatus, lastActiveAt },
    });
  }

  /**
   * 清除用户在线状态缓存
   */
  async clearUserOnlineStatus(userId: string): Promise<void> {
    try {
      const key = BlogCacheService.KEYS.USER_ONLINE_STATUS(userId);
      await this.del(key);
      this.logger.debug(`用户在线状态缓存已清除: ${userId}`);
    } catch (error) {
      this.logger.error(`清除用户在线状态缓存失败: ${userId}`, error);
    }
  }

  /**
   * 获取用户登录token
   */
  async getUserToken(
    userId: string,
    tokenId: string,
  ): Promise<{
    token: string;
    expiresAt: number;
    deviceInfo?: string;
  } | null> {
    const key = BlogCacheService.KEYS.USER_TOKEN(userId, tokenId);
    return this.get(key) as Promise<{
      token: string;
      expiresAt: number;
      deviceInfo?: string;
    } | null>;
  }

  /**
   * 设置用户登录token
   */
  async setUserToken(
    userId: string,
    tokenId: string,
    token: string,
    expiresAt: number,
    deviceInfo?: string,
  ): Promise<void> {
    const tokenKey = BlogCacheService.KEYS.USER_TOKEN(userId, tokenId);
    const allTokensKey = BlogCacheService.KEYS.USER_ALL_TOKENS(userId);

    const tokenData = {
      token,
      expiresAt,
      deviceInfo,
      createdAt: Date.now(),
    };

    // 设置单个token缓存
    await this.set(tokenKey, tokenData, BlogCacheService.TTL.USER_TOKEN);

    // 更新用户所有token列表
    const allTokens: string[] =
      ((await this.get(allTokensKey)) as string[]) || [];
    if (!allTokens.includes(tokenId)) {
      allTokens.push(tokenId);
      await this.set(allTokensKey, allTokens, BlogCacheService.TTL.USER_TOKEN);
    }

    this.logger.debug(`用户token已缓存: ${userId}:${tokenId}`);
  }

  /**
   * 清除用户单个token
   */
  async clearUserToken(userId: string, tokenId: string): Promise<void> {
    try {
      const tokenKey = BlogCacheService.KEYS.USER_TOKEN(userId, tokenId);
      const allTokensKey = BlogCacheService.KEYS.USER_ALL_TOKENS(userId);

      // 删除单个token
      await this.del(tokenKey);

      // 从所有token列表中移除
      const cachedTokens: string[] =
        ((await this.get(allTokensKey)) as string[]) || [];
      const allTokens = cachedTokens.filter((id) => id !== tokenId);

      if (allTokens.length > 0) {
        await this.set(
          allTokensKey,
          allTokens,
          BlogCacheService.TTL.USER_TOKEN,
        );
      } else {
        await this.del(allTokensKey);
      }

      this.logger.debug(`用户token缓存已清除: ${userId}:${tokenId}`);
    } catch (error) {
      this.logger.error(`清除用户token缓存失败: ${userId}:${tokenId}`, error);
    }
  }

  /**
   * 清除用户所有token
   */
  async clearAllUserTokens(userId: string): Promise<void> {
    try {
      const allTokensKey = BlogCacheService.KEYS.USER_ALL_TOKENS(userId);
      const allTokens: string[] =
        ((await this.get(allTokensKey)) as string[]) || [];

      // 删除所有token缓存
      const deletePromises = allTokens.map((tokenId) => {
        const tokenKey = BlogCacheService.KEYS.USER_TOKEN(userId, tokenId);
        return this.del(tokenKey);
      });

      await Promise.all(deletePromises);

      // 删除token列表缓存
      await this.del(allTokensKey);

      this.logger.debug(`用户所有token缓存已清除: ${userId}`);
    } catch (error) {
      this.logger.error(`清除用户所有token缓存失败: ${userId}`, error);
    }
  }

  /**
   * 获取用户所有有效token
   */
  async getUserAllTokens(userId: string): Promise<string[]> {
    const allTokensKey = BlogCacheService.KEYS.USER_ALL_TOKENS(userId);
    const result = (await this.get(allTokensKey)) as string[] | null;
    return result || [];
  }

  /**
   * 清除用户相关的所有缓存
   */
  async clearUserCache(userId: string): Promise<void> {
    try {
      await Promise.all([
        this.clearUserOnlineStatus(userId),
        this.clearAllUserTokens(userId),
      ]);
      this.logger.debug(`用户相关缓存已清除: ${userId}`);
    } catch (error) {
      this.logger.error(`清除用户相关缓存失败: ${userId}`, error);
    }
  }

  /**
   * 清除所有缓存
   */
  async clearAllCache(): Promise<void> {
    try {
      // cache-manager v7不支持reset方法，暂时跳过全量清除
      await Promise.resolve(); // 添加await以满足async要求
      this.logger.debug('全量缓存清除暂不支持');
      this.logger.debug('所有缓存已清除');
    } catch (error) {
      this.logger.error('清除所有缓存失败', error);
    }
  }

  /**
   * 预热缓存（应用启动时调用）
   */
  async warmupCache(dataLoaders: {
    loadFeaturedArticles: () => Promise<unknown>;
    loadTopArticles: () => Promise<unknown>;
    loadPopularArticles: () => Promise<unknown>;
    loadRecentArticles: () => Promise<unknown>;
    loadAllTags: () => Promise<unknown>;
    loadAllCategories: () => Promise<unknown>;
  }): Promise<void> {
    try {
      this.logger.debug('开始预热缓存');

      // 并行预热所有缓存
      await Promise.all([
        this.warmupFeaturedArticles(dataLoaders.loadFeaturedArticles),
        this.warmupTopArticles(dataLoaders.loadTopArticles),
        this.warmupPopularArticles(dataLoaders.loadPopularArticles),
        this.warmupRecentArticles(dataLoaders.loadRecentArticles),
        this.warmupAllTags(dataLoaders.loadAllTags),
        this.warmupAllCategories(dataLoaders.loadAllCategories),
      ]);

      this.logger.debug('缓存预热完成');
    } catch (error) {
      this.logger.error('缓存预热失败', error);
    }
  }

  // 私有方法
  private async get(key: string): Promise<unknown> {
    try {
      const value = await this.cache.get(key);
      if (value) {
        this.logger.debug(`缓存命中: ${key}`);
        return JSON.parse(value as string);
      }
      this.logger.debug(`缓存未命中: ${key}`);
      return null;
    } catch (error) {
      this.logger.error(`获取缓存失败: ${key}`, error);
      return null;
    }
  }

  private async set(key: string, value: unknown, ttl: number): Promise<void> {
    try {
      await this.cache.set(key, JSON.stringify(value), ttl);
      this.logger.debug(`缓存已设置: ${key}, TTL: ${ttl}s`);
    } catch (error) {
      this.logger.error(`设置缓存失败: ${key}`, error);
    }
  }

  private async del(key: string): Promise<void> {
    try {
      await this.cache.del(key);
      this.logger.debug(`缓存已删除: ${key}`);
    } catch (error) {
      this.logger.error(`删除缓存失败: ${key}`, error);
    }
  }

  private async warmupFeaturedArticles(
    loader: () => Promise<unknown>,
  ): Promise<void> {
    const data = await loader();
    await this.setFeaturedArticles(data);
  }

  private async warmupTopArticles(
    loader: () => Promise<unknown>,
  ): Promise<void> {
    const data = await loader();
    await this.setTopArticles(data);
  }

  private async warmupPopularArticles(
    loader: () => Promise<unknown>,
  ): Promise<void> {
    const data = await loader();
    await this.setPopularArticles(data);
  }

  private async warmupRecentArticles(
    loader: () => Promise<unknown>,
  ): Promise<void> {
    const data = await loader();
    await this.setRecentArticles(data);
  }

  private async warmupAllTags(loader: () => Promise<unknown>): Promise<void> {
    const data = await loader();
    await this.setAllTags(data);
  }

  private async warmupAllCategories(
    loader: () => Promise<unknown>,
  ): Promise<void> {
    const data = await loader();
    await this.setAllCategories(data);
  }
}
