import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from '@/entities/article.entity';
import { ArticleStatus } from '@/dto/article.dto';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';
import { ArticleViewService } from './article-view.service';
import { ArticleQueryService } from './article-query.service';

interface TotalStatsResult {
  totalViews: string;
  totalLikes: string;
  totalComments: string;
  totalShares: string;
}

interface PublicViewsResult {
  totalViews: string;
}

interface PublicCategoriesResult {
  totalCategories: string;
}

interface PublicTagsResult {
  totalTags: string;
}

interface CategoryStatsRaw {
  name: string;
  count: string;
}

@Injectable()
export class ArticleStatisticsService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @Inject(StructuredLoggerService)
    private readonly logger: StructuredLoggerService,
    @Inject(ArticleViewService)
    private readonly articleViewService: ArticleViewService,
    @Inject(ArticleQueryService)
    private readonly articleQueryService: ArticleQueryService,
  ) {
    this.logger.setContext({ module: 'ArticleStatisticsService' });
  }

  /**
   * 记录文章浏览，避免重复计数
   * @param articleId 文章ID
   * @param userId 用户ID（可选）
   * @param ipAddress IP地址
   * @param userAgent 用户代理
   * @param isAdmin 是否为管理员
   * @returns 是否为新的浏览记录
   */
  async recordView(
    articleId: string,
    userId: string | null,
    ipAddress: string,
    userAgent: string | null,
    isAdmin: boolean = false,
  ): Promise<boolean> {
    return this.articleViewService.recordView(
      articleId,
      userId,
      ipAddress,
      userAgent,
      isAdmin,
    );
  }

  /**
   * 增加文章点赞数
   */
  async like(id: string): Promise<void> {
    await this.articleRepository.increment({ id }, 'likeCount', 1);
  }

  /**
   * 增加文章分享数
   */
  async share(id: string): Promise<void> {
    await this.articleRepository.increment({ id }, 'shareCount', 1);
  }

  /**
   * 获取文章统计信息
   */
  async getStatistics(): Promise<{
    total: number;
    published: number;
    draft: number;
    archived: number;
    featuredCount: number;
    topCount: number;
  }> {
    const [total, published, draft, archived, featuredCount, topCount] =
      await Promise.all([
        this.articleRepository.count(),
        this.articleRepository.count({
          where: { status: ArticleStatus.PUBLISHED },
        }),
        this.articleRepository.count({
          where: { status: ArticleStatus.DRAFT },
        }),
        this.articleRepository.count({
          where: { status: ArticleStatus.ARCHIVED },
        }),
        this.articleRepository.count({ where: { isFeatured: true } }),
        this.articleRepository.count({ where: { isTop: true } }),
      ]);

    return { total, published, draft, archived, featuredCount, topCount };
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

    return formattedResult;
  }

  /**
   * 获取文章阅读时长统计
   */
  async getReadingTimeStats(): Promise<{
    average: number;
    distribution: { range: string; count: number }[];
  }> {
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

    return { average, distribution };
  }

  /**
   * 获取管理端详细统计信息
   */
  async getAdminStatistics(): Promise<any> {
    const [
      basicStats,
      categoryStats,
      monthlyStats,
      totalStats,
      readingTimeStats,
      tagStats,
      popularArticlesResult,
      recentArticlesResult,
    ] = await Promise.all([
      this.getStatistics(),
      this.getCategoryStats(),
      this.articleQueryService.getArchiveStats(),
      this.getTotalStats(),
      this.getReadingTimeStats(),
      this.getPopularTags(10),
      this.articleQueryService.getPopularArticles({ limit: 5 }),
      this.articleQueryService.getRecentArticles({ limit: 5 }),
    ]);

    return {
      ...basicStats,
      ...totalStats,
      categoryStats,
      monthlyStats,
      readingTimeStats,
      tagStats,
      popularArticles: popularArticlesResult.items,
      recentArticles: recentArticlesResult.items,
    };
  }

  /**
   * 获取分类统计
   */
  private async getCategoryStats(): Promise<
    { name: string; count: number; percentage: number }[]
  > {
    const result = await this.articleRepository
      .createQueryBuilder('article')
      .leftJoin('article.category', 'category')
      .select('category.name', 'name')
      .addSelect('COUNT(article.id)', 'count')
      .where('article.status = :status', { status: 'published' })
      .andWhere('article.isVisible = :isVisible', { isVisible: true })
      .groupBy('category.id')
      .orderBy('count', 'DESC')
      .getRawMany<CategoryStatsRaw>();

    const total = result.reduce((sum, item) => sum + parseInt(item.count), 0);

    return result.map((item) => ({
      name: item.name || '未分类',
      count: parseInt(item.count),
      percentage:
        total > 0 ? Math.round((parseInt(item.count) / total) * 100) : 0,
    }));
  }

  /**
   * 获取总体统计
   */
  private async getTotalStats(): Promise<{
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
  }> {
    const result = (await this.articleRepository
      .createQueryBuilder('article')
      .select('SUM(article.viewCount)', 'totalViews')
      .addSelect('SUM(article.likeCount)', 'totalLikes')
      .addSelect('SUM(article.commentCount)', 'totalComments')
      .addSelect('SUM(article.shareCount)', 'totalShares')
      .where('article.status = :status', { status: 'published' })
      .andWhere('article.isVisible = :isVisible', { isVisible: true })
      .getRawOne()) as TotalStatsResult | null;

    return {
      totalViews: parseInt(result?.totalViews || '0'),
      totalLikes: parseInt(result?.totalLikes || '0'),
      totalComments: parseInt(result?.totalComments || '0'),
      totalShares: parseInt(result?.totalShares || '0'),
    };
  }

  /**
   * 获取用户端统计信息
   */
  async getPublicStatistics(): Promise<{
    totalArticles: number;
    totalViews: number;
    totalCategories: number;
    totalTags: number;
    monthlyStats: { year: number; month: number; count: number }[];
  }> {
    const [basicStats, totalViews, totalCategories, totalTags, monthlyStats] =
      await Promise.all([
        this.getStatistics(),
        this.getPublicTotalViews(),
        this.getPublicTotalCategories(),
        this.getPublicTotalTags(),
        this.articleQueryService.getArchiveStats(),
      ]);

    return {
      totalArticles: basicStats.published,
      totalViews,
      totalCategories,
      totalTags,
      monthlyStats,
    };
  }

  /**
   * 获取用户端总浏览数
   */
  private async getPublicTotalViews(): Promise<number> {
    const result = (await this.articleRepository
      .createQueryBuilder('article')
      .select('SUM(article.viewCount)', 'totalViews')
      .where('article.status = :status', { status: 'published' })
      .andWhere('article.isVisible = :isVisible', { isVisible: true })
      .getRawOne()) as PublicViewsResult | null;

    return parseInt(result?.totalViews || '0');
  }

  /**
   * 获取用户端分类总数
   */
  private async getPublicTotalCategories(): Promise<number> {
    const result = (await this.articleRepository
      .createQueryBuilder('article')
      .leftJoin('article.category', 'category')
      .select('COUNT(DISTINCT category.id)', 'totalCategories')
      .where('article.status = :status', { status: 'published' })
      .andWhere('article.isVisible = :isVisible', { isVisible: true })
      .getRawOne()) as PublicCategoriesResult | null;

    return parseInt(result?.totalCategories || '0');
  }

  /**
   * 获取用户端标签总数
   */
  private async getPublicTotalTags(): Promise<number> {
    const result = (await this.articleRepository
      .createQueryBuilder('article')
      .leftJoin('article.tags', 'tag')
      .select('COUNT(DISTINCT tag.id)', 'totalTags')
      .where('article.status = :status', { status: 'published' })
      .andWhere('article.isVisible = :isVisible', { isVisible: true })
      .getRawOne()) as PublicTagsResult | null;

    return parseInt(result?.totalTags || '0');
  }
}
