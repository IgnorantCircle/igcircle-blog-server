import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from '@/entities/article.entity';
import { ArticleStatus } from '@/dto/article.dto';
import { CacheService } from '@/common/cache/cache.service';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';
import { CACHE_TYPES } from '@/common/cache/cache.config';

@Injectable()
export class ArticleStatisticsService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @Inject(CacheService)
    private readonly cacheService: CacheService,
    @Inject(StructuredLoggerService)
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext({ module: 'ArticleStatisticsService' });
  }

  /**
   * 增加文章浏览量
   */
  async incrementViews(id: string): Promise<void> {
    await this.articleRepository.increment({ id }, 'viewCount', 1);
    // 清除相关缓存
    await this.clearArticleStatisticsCache(id);
  }

  /**
   * 增加文章点赞数
   */
  async like(id: string): Promise<void> {
    await this.articleRepository.increment({ id }, 'likeCount', 1);
    // 清除相关缓存
    await this.clearArticleStatisticsCache(id);
  }

  /**
   * 增加文章分享数
   */
  async share(id: string): Promise<void> {
    await this.articleRepository.increment({ id }, 'shareCount', 1);
    // 清除相关缓存
    await this.clearArticleStatisticsCache(id);
  }

  /**
   * 获取文章统计信息
   */
  async getStatistics(): Promise<{
    total: number;
    published: number;
    draft: number;
    archived: number;
  }> {
    const cacheKey = 'article:stats:overview';
    const cached = await this.cacheService.get(cacheKey, {
      type: CACHE_TYPES.ARTICLE,
    });
    if (cached) {
      return cached as {
        total: number;
        published: number;
        draft: number;
        archived: number;
      };
    }

    const [total, published, draft, archived] = await Promise.all([
      this.articleRepository.count(),
      this.articleRepository.count({ where: { status: 'published' } }),
      this.articleRepository.count({ where: { status: 'draft' } }),
      this.articleRepository.count({ where: { status: 'archived' } }),
    ]);

    const stats = { total, published, draft, archived };
    await this.cacheService.set(cacheKey, stats, {
      type: CACHE_TYPES.ARTICLE,
    });

    return stats;
  }

  /**
   * 获取文章浏览历史统计
   */
  async getViewHistory(
    id: string,
    days: number = 30,
  ): Promise<{ date: string; views: number }[]> {
    const cacheKey = `article:view-history:${id}:${days}`;
    const cached = await this.cacheService.get<
      { date: string; views: number }[]
    >(cacheKey, { type: CACHE_TYPES.ARTICLE });
    if (cached) {
      return cached;
    }

    // 这里应该从专门的浏览历史表获取数据
    // 暂时返回模拟数据，实际项目中应该有专门的浏览记录表
    const history: { date: string; views: number }[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      history.push({
        date: date.toISOString().split('T')[0],
        views: Math.floor(Math.random() * 100), // 模拟数据
      });
    }

    await this.cacheService.set(cacheKey, history, {
      type: CACHE_TYPES.ARTICLE,
    });

    return history;
  }

  /**
   * 获取热门标签（基于文章数量）
   */
  async getPopularTags(limit: number = 10): Promise<
    {
      id: string;
      name: string;
      articleCount: number;
    }[]
  > {
    const cacheKey = `article:popular-tags:${limit}`;
    const cached = await this.cacheService.get<
      {
        id: string;
        name: string;
        articleCount: number;
      }[]
    >(cacheKey, { type: CACHE_TYPES.ARTICLE });
    if (cached) {
      return cached;
    }

    const result = await this.articleRepository
      .createQueryBuilder('article')
      .leftJoin('article.tags', 'tag')
      .select('tag.id', 'id')
      .addSelect('tag.name', 'name')
      .addSelect('COUNT(article.id)', 'articleCount')
      .where('article.status = :status', { status: 'published' })
      .andWhere('article.isVisible = :isVisible', { isVisible: true })
      .groupBy('tag.id')
      .orderBy('articleCount', 'DESC')
      .limit(limit)
      .getRawMany();

    const formattedResult = result.map(
      (item: { id: string; name: string; articleCount: string }) => {
        const tagId = item.id;
        const tagName = item.name;
        const articleCount = parseInt(item.articleCount);
        return {
          id: tagId,
          name: tagName,
          articleCount: articleCount,
        };
      },
    );

    await this.cacheService.set(cacheKey, formattedResult, {
      type: CACHE_TYPES.ARTICLE,
    });

    return formattedResult;
  }

  /**
   * 获取文章阅读时长统计
   */
  async getReadingTimeStats(): Promise<{
    average: number;
    distribution: { range: string; count: number }[];
  }> {
    const cacheKey = 'article:reading-time-stats';
    const cached = await this.cacheService.get<{
      average: number;
      distribution: { range: string; count: number }[];
    }>(cacheKey, { type: CACHE_TYPES.ARTICLE });
    if (cached) {
      return cached;
    }

    const articles = await this.articleRepository.find({
      where: { status: ArticleStatus.PUBLISHED, isVisible: true },
      select: ['readingTime'],
    });

    const readingTimes = articles
      .map((article) => article.readingTime || 0)
      .filter((time) => time > 0);

    const average =
      readingTimes.reduce((sum, time) => sum + time, 0) / readingTimes.length ||
      0;

    // 分布统计
    const distribution = [
      { range: '0-2分钟', count: 0 },
      { range: '3-5分钟', count: 0 },
      { range: '6-10分钟', count: 0 },
      { range: '11-20分钟', count: 0 },
      { range: '20分钟以上', count: 0 },
    ];

    readingTimes.forEach((time) => {
      if (time <= 2) distribution[0].count++;
      else if (time <= 5) distribution[1].count++;
      else if (time <= 10) distribution[2].count++;
      else if (time <= 20) distribution[3].count++;
      else distribution[4].count++;
    });

    const stats = { average, distribution };
    await this.cacheService.set(cacheKey, stats, {
      type: CACHE_TYPES.ARTICLE,
    });

    return stats;
  }

  /**
   * 清除文章统计相关缓存
   */
  private async clearArticleStatisticsCache(articleId?: string): Promise<void> {
    try {
      const promises = [
        this.cacheService.clearCacheByPattern('article:stats:*'),
        this.cacheService.clearCacheByPattern('article:popular-tags:*'),
        this.cacheService.clearCacheByPattern('article:reading-time-stats'),
      ];

      if (articleId) {
        promises.push(
          this.cacheService.clearCacheByPattern(
            `article:view-history:${articleId}:*`,
          ),
        );
        // 清除文章本身的缓存
        promises.push(
          this.cacheService.del(articleId, { type: CACHE_TYPES.ARTICLE }),
        );
      }

      await Promise.all(promises);
    } catch (error) {
      this.logger.warn('清除文章统计缓存失败', {
        metadata: {
          articleId,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
}
