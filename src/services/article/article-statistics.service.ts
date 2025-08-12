import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from '@/entities/article.entity';
import { ArticleStatus } from '@/dto/article.dto';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';

@Injectable()
export class ArticleStatisticsService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
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
}
