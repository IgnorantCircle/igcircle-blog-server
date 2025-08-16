import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Article } from '@/entities/article.entity';
import { ArticleLike } from '@/entities/article-like.entity';
import { ArticleFavorite } from '@/entities/article-favorite.entity';
import { ErrorCode } from '@/common/constants/error-codes';
import { ArticleStatisticsService } from './article-statistics.service';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';

@Injectable()
export class ArticleInteractionService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @InjectRepository(ArticleLike)
    private readonly articleLikeRepository: Repository<ArticleLike>,
    @InjectRepository(ArticleFavorite)
    private readonly articleFavoriteRepository: Repository<ArticleFavorite>,
    private readonly dataSource: DataSource,
    @Inject(ArticleStatisticsService)
    private readonly articleStatisticsService: ArticleStatisticsService,
    @Inject(StructuredLoggerService)
    private readonly logger: StructuredLoggerService,
  ) {}

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
    return this.articleStatisticsService.recordView(
      articleId,
      userId,
      ipAddress,
      userAgent,
      isAdmin,
    );
  }

  /**
   * 点赞文章（简单版本）
   * @param id 文章ID
   */
  async like(id: string): Promise<void> {
    return this.articleStatisticsService.like(id);
  }

  /**
   * 分享文章
   * @param id 文章ID
   */
  async share(id: string): Promise<void> {
    return this.articleStatisticsService.share(id);
  }

  /**
   * 切换用户对文章的点赞状态
   * @param articleId 文章ID
   * @param userId 用户ID
   * @returns 是否点赞（true: 点赞, false: 取消点赞）
   */
  async toggleLike(articleId: string, userId: string): Promise<boolean> {
    // 验证文章是否存在
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
    });
    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    return this.dataSource.transaction(async (manager) => {
      const existingLike = await manager.findOne(ArticleLike, {
        where: { articleId, userId },
      });

      if (existingLike) {
        // 取消点赞
        await manager.remove(ArticleLike, existingLike);
        await manager.decrement(Article, { id: articleId }, 'likeCount', 1);
        return false;
      } else {
        // 添加点赞
        const like = manager.create(ArticleLike, { articleId, userId });
        await manager.save(ArticleLike, like);
        await manager.increment(Article, { id: articleId }, 'likeCount', 1);
        return true;
      }
    });
  }

  /**
   * 切换用户对文章的收藏状态
   * @param articleId 文章ID
   * @param userId 用户ID
   * @returns 是否收藏（true: 收藏, false: 取消收藏）
   */
  async toggleFavorite(articleId: string, userId: string): Promise<boolean> {
    // 验证文章是否存在
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
    });
    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    return this.dataSource.transaction(async (manager) => {
      const existingFavorite = await manager.findOne(ArticleFavorite, {
        where: { articleId, userId },
      });

      if (existingFavorite) {
        // 取消收藏
        await manager.remove(ArticleFavorite, existingFavorite);
        return false;
      } else {
        // 添加收藏
        const favorite = manager.create(ArticleFavorite, { articleId, userId });
        await manager.save(ArticleFavorite, favorite);
        return true;
      }
    });
  }

  /**
   * 检查用户是否点赞了文章
   * @param articleId 文章ID
   * @param userId 用户ID
   * @returns 是否点赞
   */
  async checkUserLike(articleId: string, userId: string): Promise<boolean> {
    const like = await this.articleLikeRepository.findOne({
      where: { articleId, userId },
    });
    return !!like;
  }

  /**
   * 检查用户是否收藏了文章
   * @param articleId 文章ID
   * @param userId 用户ID
   * @returns 是否收藏
   */
  async checkUserFavorite(articleId: string, userId: string): Promise<boolean> {
    const favorite = await this.articleFavoriteRepository.findOne({
      where: { articleId, userId },
    });
    return !!favorite;
  }

  /**
   * 批量检查用户对多篇文章的点赞状态
   * @param articleIds 文章ID数组
   * @param userId 用户ID
   * @returns 文章ID到点赞状态的映射
   */
  async checkUserLikes(
    articleIds: string[],
    userId: string,
  ): Promise<Record<string, boolean>> {
    const likes = await this.articleLikeRepository.find({
      where: { articleId: In(articleIds), userId },
    });

    const likeMap: Record<string, boolean> = {};
    articleIds.forEach((id) => {
      likeMap[id] = false;
    });
    likes.forEach((like) => {
      likeMap[like.articleId] = true;
    });

    return likeMap;
  }

  /**
   * 批量检查用户对多篇文章的收藏状态
   * @param articleIds 文章ID数组
   * @param userId 用户ID
   * @returns 文章ID到收藏状态的映射
   */
  async checkUserFavorites(
    articleIds: string[],
    userId: string,
  ): Promise<Record<string, boolean>> {
    const favorites = await this.articleFavoriteRepository.find({
      where: { articleId: In(articleIds), userId },
    });

    const favoriteMap: Record<string, boolean> = {};
    articleIds.forEach((id) => {
      favoriteMap[id] = false;
    });
    favorites.forEach((favorite) => {
      favoriteMap[favorite.articleId] = true;
    });

    return favoriteMap;
  }

  /**
   * 获取用户点赞的文章列表
   * @param userId 用户ID
   * @param page 页码
   * @param limit 每页数量
   * @returns 分页的文章列表
   */
  async getUserLikedArticles(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ items: Article[]; total: number }> {
    const queryBuilder = this.articleRepository
      .createQueryBuilder('article')
      .innerJoin(
        ArticleLike,
        'like',
        'like.articleId = article.id AND like.userId = :userId',
        { userId },
      )
      .leftJoinAndSelect('article.author', 'author')
      .leftJoinAndSelect('article.category', 'category')
      .leftJoinAndSelect('article.tags', 'tags')
      .where('article.status = :status', { status: 'published' })
      .orderBy('like.createdAt', 'DESC');

    const total = await queryBuilder.getCount();
    const items = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { items, total };
  }

  /**
   * 获取用户收藏的文章列表
   * @param userId 用户ID
   * @param page 页码
   * @param limit 每页数量
   * @returns 分页的文章列表
   */
  async getUserFavoriteArticles(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ items: Article[]; total: number }> {
    const queryBuilder = this.articleRepository
      .createQueryBuilder('article')
      .innerJoin(
        ArticleFavorite,
        'favorite',
        'favorite.articleId = article.id AND favorite.userId = :userId',
        { userId },
      )
      .leftJoinAndSelect('article.author', 'author')
      .leftJoinAndSelect('article.category', 'category')
      .leftJoinAndSelect('article.tags', 'tags')
      .where('article.status = :status', { status: 'published' })
      .orderBy('favorite.createdAt', 'DESC');

    const total = await queryBuilder.getCount();
    const items = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { items, total };
  }
}
