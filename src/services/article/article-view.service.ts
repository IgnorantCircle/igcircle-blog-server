import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ArticleView } from '@/entities/article-view.entity';
import { Article } from '@/entities/article.entity';
import { BlogCacheService } from '@/common/cache/blog-cache.service';

@Injectable()
export class ArticleViewService {
  constructor(
    @InjectRepository(ArticleView)
    private readonly articleViewRepository: Repository<ArticleView>,
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @Inject(BlogCacheService)
    private readonly blogCacheService: BlogCacheService,
  ) {}

  /**
   * 记录文章浏览，避免重复计数
   * @param articleId 文章ID
   * @param userId 用户ID（可选，未登录时为null）
   * @param ipAddress IP地址
   * @param userAgent 用户代理
   * @param isAdmin 是否为管理员（管理员浏览不计数）
   * @returns 是否为新的浏览记录
   */
  async recordView(
    articleId: string,
    userId: string | null,
    ipAddress: string,
    userAgent: string | null,
    isAdmin: boolean = false,
  ): Promise<boolean> {
    // 管理员浏览不计数
    if (isAdmin) {
      return false;
    }

    // 检查是否已经浏览过
    const existingView = await this.checkExistingView(
      articleId,
      userId,
      ipAddress,
    );
    if (existingView) {
      return false;
    }

    // 创建新的浏览记录
    const articleView = this.articleViewRepository.create({
      articleId,
      userId,
      ipAddress,
      userAgent,
    });

    try {
      await this.articleViewRepository.save(articleView);

      // 增加文章浏览计数
      await this.articleRepository.increment({ id: articleId }, 'viewCount', 1);

      // 清除相关缓存
      await this.clearRelatedCaches(articleId);

      return true;
    } catch (error) {
      // 如果是唯一约束冲突（并发情况下可能发生），则不计数
      if (
        (error as any).code === 'ER_DUP_ENTRY' ||
        (error as any).code === '23505'
      ) {
        return false;
      }
      throw error;
    }
  }

  /**
   * 检查是否已经浏览过
   * @param articleId 文章ID
   * @param userId 用户ID
   * @param ipAddress IP地址
   * @returns 是否已存在浏览记录
   */
  private async checkExistingView(
    articleId: string,
    userId: string | null,
    ipAddress: string,
  ): Promise<boolean> {
    const whereCondition: Record<string, any> = { articleId };

    if (userId) {
      // 登录用户：按用户ID去重
      whereCondition.userId = userId;
    } else {
      // 未登录用户：按IP地址去重
      whereCondition.ipAddress = ipAddress;
      whereCondition.userId = IsNull(); // 确保是未登录用户的记录
    }

    const existingView = await this.articleViewRepository.findOne({
      where: whereCondition,
    });

    return !!existingView;
  }

  /**
   * 清除相关缓存
   * @param articleId 文章ID
   */
  private async clearRelatedCaches(articleId: string): Promise<void> {
    try {
      // 获取文章的slug
      const article = await this.articleRepository.findOne({
        where: { id: articleId },
        select: ['slug'],
      });

      if (article) {
        // 清除文章详情缓存（使用slug）
        await this.blogCacheService.clearArticleCache(article.slug);
      }

      // 清除热门文章缓存（因为viewCount变化可能影响排序）
      await this.blogCacheService.clearPopularArticlesCache();
    } catch (error) {
      // 缓存清除失败不应该影响主要业务逻辑
      console.error('清除缓存失败:', error);
    }
  }

  /**
   * 获取文章的浏览统计
   * @param articleId 文章ID
   * @returns 浏览统计信息
   */
  async getViewStats(articleId: string): Promise<{
    totalViews: number;
    uniqueViews: number;
    registeredUserViews: number;
    anonymousViews: number;
  }> {
    const [totalViews, uniqueViews, registeredUserViews, anonymousViews] =
      await Promise.all([
        // 总浏览次数（从文章表获取）
        this.articleRepository
          .findOne({ where: { id: articleId }, select: ['viewCount'] })
          .then((article) => article?.viewCount || 0),

        // 独立浏览次数
        this.articleViewRepository.count({ where: { articleId } }),

        // 注册用户浏览次数
        this.articleViewRepository
          .createQueryBuilder('view')
          .where('view.articleId = :articleId', { articleId })
          .andWhere('view.userId IS NOT NULL')
          .getCount(),

        // 匿名用户浏览次数
        this.articleViewRepository.count({
          where: { articleId, userId: IsNull() },
        }),
      ]);

    return {
      totalViews,
      uniqueViews,
      registeredUserViews,
      anonymousViews,
    };
  }

  /**
   * 清理过期的浏览记录（可选，用于数据清理）
   * @param daysToKeep 保留天数
   */
  async cleanupOldViews(daysToKeep: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.articleViewRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }
}
