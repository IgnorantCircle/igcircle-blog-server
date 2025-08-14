import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Article } from '@/entities/article.entity';
import { Tag } from '@/entities/tag.entity';
import { ArticleQueryDto, ArticleStatus } from '@/dto/article.dto';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';
import { PaginationUtil } from '@/common/utils/pagination.util';
import { BaseService } from '@/common/base/base.service';
import { ConfigService } from '@nestjs/config';
import { BlogCacheService } from '@/common/cache/blog-cache.service';

export type ArticleQueryOptions = Omit<ArticleQueryDto, 'skip'>;

export interface ArticleQueryResult {
  items: Article[];
  total: number;
}

@Injectable()
export class ArticleQueryService extends BaseService<Article> {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @Inject(StructuredLoggerService) logger: StructuredLoggerService,
    @Inject(ConfigService) configService: ConfigService,
    @Inject(BlogCacheService) private readonly cacheManager: BlogCacheService,
  ) {
    super(articleRepository, 'article', configService, logger);
    this.logger.setContext({ module: 'ArticleQueryService' });
  }

  /**
   * 分页查询文章（带缓存）
   */
  async findAllPaginated(
    options: ArticleQueryOptions,
    useCache: boolean = true,
  ): Promise<ArticleQueryResult> {
    const { page = 1, limit = 10 } = options;

    // 如果不使用缓存或没有缓存管理器，直接执行查询
    if (!useCache || !this.cacheManager) {
      return this.executeQuery(options);
    }

    // 对于管理员查询（包含非已发布状态的文章），不使用缓存
    // 因为管理员可以看到所有状态的文章，缓存会导致数据不一致
    if (!options.status || options.status !== ArticleStatus.PUBLISHED) {
      return this.executeQuery(options);
    }

    // 对于有特殊过滤条件的查询，不使用缓存
    if (
      options.categoryIds ||
      options.tagIds ||
      options.isFeatured !== undefined ||
      options.isTop !== undefined ||
      options.keyword ||
      options.year ||
      options.month
    ) {
      return this.executeQuery(options);
    }

    // 只对简单的已发布文章列表查询使用缓存
    const cached = await this.cacheManager.getArticleList(page, limit);
    if (cached) {
      return cached as ArticleQueryResult;
    }

    // 执行查询并缓存结果
    const result = await this.executeQuery(options);
    await this.cacheManager.setArticleList(result, page, limit);

    return result;
  }

  /**
   * 执行实际的查询逻辑
   */
  private async executeQuery(
    options: ArticleQueryOptions,
  ): Promise<ArticleQueryResult> {
    const {
      page = 1,
      limit = 10,
      tagIds,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      includeTags = false,
      includeCategory = true,
    } = options;

    const skip = PaginationUtil.calculateSkip(page, limit);

    // 使用优化的查询构建器，根据用户请求动态决定是否包含标签、分类
    const queryBuilder = this.createOptimizedQueryBuilder('list', {
      includeTags,
      includeCategory,
    });

    // 应用过滤条件
    this.applyFilters(queryBuilder, options);

    // 应用排序
    queryBuilder.orderBy(`article.${sortBy}`, sortOrder);

    // 如果有标签过滤，需要去重
    if (tagIds && tagIds.length > 0) {
      queryBuilder.distinct(true);
    }

    // 分页
    queryBuilder.skip(skip).take(limit);

    // 执行查询
    const [items, total] = await queryBuilder.getManyAndCount();

    // 如果需要标签信息，批量加载
    if (items.length > 0 && (!tagIds || tagIds.length === 0)) {
      await this.loadTagsForArticles(items as any);
    }

    return { items, total };
  }

  /**
   * 批量加载文章的标签信息，避免N+1查询
   */
  private async loadTagsForArticles(articles: Article[]): Promise<void> {
    if (articles.length === 0) return;

    const articleIds = articles.map((article) => article.id);

    // 一次性查询所有文章的标签关联
    const articleTags = await this.articleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.tags', 'tags')
      .where('article.id IN (:...articleIds)', { articleIds })
      .select(['article.id', 'tags.id', 'tags.name', 'tags.slug', 'tags.color'])
      .getMany();

    // 构建标签映射
    const tagsMap = new Map<string, Tag[]>();
    articleTags.forEach((article) => {
      tagsMap.set(article.id, article.tags || []);
    });

    // 将标签信息分配给对应的文章
    articles.forEach((article) => {
      article.tags = tagsMap.get(article.id) || [];
    });
  }

  /**
   * 获取热门文章
   */
  async getPopularArticles(
    options: ArticleQueryOptions = {},
  ): Promise<ArticleQueryResult> {
    // 如果不使用缓存，直接执行查询
    if (!this.cacheManager) {
      const popularOptions: ArticleQueryOptions = {
        ...options,
        status: ArticleStatus.PUBLISHED, // 强制只返回已发布的文章
        sortBy: 'viewCount',
        sortOrder: 'DESC',
      };
      return this.executeQuery(popularOptions);
    }

    // 尝试从缓存获取热门文章
    const cached = await this.cacheManager.getPopularArticles();
    if (cached) {
      return cached as ArticleQueryResult;
    }

    // 执行查询并缓存结果
    const popularOptions: ArticleQueryOptions = {
      ...options,
      status: ArticleStatus.PUBLISHED, // 强制只返回已发布的文章
      sortBy: 'viewCount',
      sortOrder: 'DESC',
    };
    const result = await this.executeQuery(popularOptions);
    await this.cacheManager.setPopularArticles(result);

    return result;
  }

  /**
   * 获取最新文章
   */
  async getRecentArticles(
    options: ArticleQueryOptions = {},
  ): Promise<ArticleQueryResult> {
    // 如果不使用缓存，直接执行查询
    if (!this.cacheManager) {
      const recentOptions: ArticleQueryOptions = {
        ...options,
        status: ArticleStatus.PUBLISHED, // 强制只返回已发布的文章
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      };
      return this.executeQuery(recentOptions);
    }

    // 尝试从缓存获取最新文章
    const cached = await this.cacheManager.getRecentArticles();
    if (cached) {
      return cached as ArticleQueryResult;
    }

    // 执行查询并缓存结果
    const recentOptions: ArticleQueryOptions = {
      ...options,
      status: ArticleStatus.PUBLISHED, // 强制只返回已发布的文章
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    };
    const result = await this.executeQuery(recentOptions);
    await this.cacheManager.setRecentArticles(result);

    return result;
  }

  /**
   * 获取精选文章
   */
  async getFeaturedArticles(
    options: ArticleQueryOptions = {},
  ): Promise<ArticleQueryResult> {
    // 如果不使用缓存，直接执行查询
    if (!this.cacheManager) {
      const featuredOptions: ArticleQueryOptions = {
        ...options,
        status: ArticleStatus.PUBLISHED, // 强制只返回已发布的文章
        isFeatured: true,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      };
      return this.executeQuery(featuredOptions);
    }

    // 尝试从缓存获取精选文章
    const cached = await this.cacheManager.getFeaturedArticles();
    if (cached) {
      return cached as ArticleQueryResult;
    }

    // 执行查询并缓存结果
    const featuredOptions: ArticleQueryOptions = {
      ...options,
      status: ArticleStatus.PUBLISHED, // 强制只返回已发布的文章
      isFeatured: true,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    };
    const result = await this.executeQuery(featuredOptions);
    await this.cacheManager.setFeaturedArticles(result);

    return result;
  }

  /**
   * 搜索文章（优化版）
   */
  async searchArticles(
    keyword: string,
    options: Omit<ArticleQueryOptions, 'keyword'> = {},
  ): Promise<ArticleQueryResult> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      includeTags = false,
      includeCategory = true,
    } = options;
    const skip = PaginationUtil.calculateSkip(page, limit);

    // 使用搜索优化的查询构建器，根据用户请求动态决定是否包含标签、分类
    const queryBuilder = this.createOptimizedQueryBuilder('search', {
      includeTags,
      includeCategory,
    });

    // 应用搜索条件（优化：使用全文搜索或更高效的LIKE查询）
    queryBuilder
      .where('article.status = :status', { status: 'published' })
      .andWhere('article.isVisible = :isVisible', { isVisible: true })
      .andWhere(
        '(article.title LIKE :keyword OR article.content LIKE :keyword OR article.summary LIKE :keyword)',
        { keyword: `%${keyword}%` },
      );

    // 应用其他过滤条件
    this.applyFilters(queryBuilder, options);

    // 应用排序（搜索结果可以按相关性排序）
    if (sortBy === 'relevance') {
      // 简单的相关性排序：标题匹配优先
      queryBuilder
        .addSelect(
          `CASE 
            WHEN article.title LIKE :titleKeyword THEN 3
            WHEN article.summary LIKE :summaryKeyword THEN 2
            ELSE 1
          END`,
          'relevance',
        )
        .setParameter('titleKeyword', `%${keyword}%`)
        .setParameter('summaryKeyword', `%${keyword}%`)
        .orderBy('relevance', 'DESC')
        .addOrderBy('article.publishedAt', 'DESC');
    } else {
      queryBuilder.orderBy(`article.${sortBy}`, sortOrder);
    }

    // 分页
    queryBuilder.skip(skip).take(limit);

    // 执行查询
    const [items, total] = await queryBuilder.getManyAndCount();

    // 批量加载标签信息
    if (items.length > 0) {
      await this.loadTagsForArticles(items);
    }

    return { items, total };
  }

  /**
   * 获取归档文章
   */
  async getArchivedArticles(
    year?: number,
    month?: number,
    page: number = 1,
    limit: number = 10,
  ): Promise<ArticleQueryResult> {
    const skip = PaginationUtil.calculateSkip(page, limit);

    const queryBuilder = this.createBaseQueryBuilder()
      .where('article.status = :status', { status: 'published' })
      .andWhere('article.isVisible = :isVisible', { isVisible: true });

    if (year) {
      queryBuilder.andWhere('YEAR(article.publishedAt) = :year', { year });
    }
    if (month) {
      queryBuilder.andWhere('MONTH(article.publishedAt) = :month', { month });
    }

    queryBuilder.orderBy('article.publishedAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();

    return { items, total };
  }

  /**
   * 获取归档统计数据
   */
  async getArchiveStats(): Promise<
    { year: number; month: number; count: number }[]
  > {
    const result = await this.articleRepository
      .createQueryBuilder('article')
      .select('YEAR(article.publishedAt)', 'year')
      .addSelect('MONTH(article.publishedAt)', 'month')
      .addSelect('COUNT(article.id)', 'count')
      .where('article.status = :status', { status: 'published' })
      .andWhere('article.isVisible = :isVisible', { isVisible: true })
      .andWhere('article.publishedAt IS NOT NULL')
      .groupBy('year, month')
      .orderBy('year', 'DESC')
      .addOrderBy('month', 'DESC')
      .getRawMany();

    return result.map((item: any) => ({
      year: parseInt(item.year),
      month: parseInt(item.month),
      count: parseInt(item.count),
    }));
  }

  /**
   * 根据分类获取文章
   */
  async getArticlesByCategory(
    categoryId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<ArticleQueryResult> {
    return this.findAllPaginated({
      categoryIds: [categoryId],
      status: ArticleStatus.PUBLISHED,
      page,
      limit,
      sortBy: 'publishedAt',
      sortOrder: 'DESC',
    });
  }

  /**
   * 根据标签获取文章
   */
  async getArticlesByTag(
    tagId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<ArticleQueryResult> {
    return this.findAllPaginated({
      tagIds: [tagId],
      status: ArticleStatus.PUBLISHED,
      page,
      limit,
      sortBy: 'publishedAt',
      sortOrder: 'DESC',
    });
  }

  /**
   * 获取相关文章
   */
  async getRelatedArticles(id: string, limit: number = 5): Promise<Article[]> {
    // 获取当前文章信息（只查询必要字段）
    const currentArticle = await this.articleRepository.findOne({
      where: { id },
      relations: ['category', 'tags'],
      select: ['id', 'categoryId', 'authorId'],
    });

    if (!currentArticle) {
      return [];
    }

    // 使用优化的查询构建器
    const queryBuilder = this.createOptimizedQueryBuilder('list')
      .where('article.status = :status', { status: 'published' })
      .andWhere('article.isVisible = :isVisible', { isVisible: true })
      .andWhere('article.id != :currentId', { currentId: id });

    // 构建相关性查询（优化：使用子查询提高性能）
    const conditions: string[] = [];
    const parameters: Record<string, any> = {};

    // 同分类的文章
    if (currentArticle.categoryId) {
      conditions.push('article.categoryId = :categoryId');
      parameters.categoryId = currentArticle.categoryId;
    }

    // 有共同标签的文章（优化：使用EXISTS子查询）
    if (currentArticle.tags && currentArticle.tags.length > 0) {
      const tagIds = currentArticle.tags.map(
        (tag: any) => (tag as { id: string }).id,
      );
      conditions.push(
        `EXISTS (
          SELECT 1 FROM article_tags_tag att 
          WHERE att.articleId = article.id 
          AND att.tagId IN (:...tagIds)
        )`,
      );
      parameters.tagIds = tagIds;
    }

    if (conditions.length > 0) {
      queryBuilder.andWhere(`(${conditions.join(' OR ')})`, parameters);
    }

    // 按相关性和时间排序
    queryBuilder
      .addSelect(
        `CASE 
          WHEN article.categoryId = :categoryId THEN 2
          ELSE 1
        END`,
        'category_relevance',
      )
      .orderBy('category_relevance', 'DESC')
      .addOrderBy('article.publishedAt', 'DESC')
      .limit(limit * 2); // 查询更多结果以便去重后仍有足够数量

    const articles = await queryBuilder.getMany();

    // 如果相关文章不够，补充同作者的文章
    if (articles.length < limit) {
      const remainingLimit = limit - articles.length;
      const existingIds = articles.map((a) => a.id);

      const authorArticles = await this.createOptimizedQueryBuilder('list')
        .where('article.status = :status', { status: 'published' })
        .andWhere('article.isVisible = :isVisible', { isVisible: true })
        .andWhere('article.id != :currentId', { currentId: id })
        .andWhere('article.authorId = :authorId', {
          authorId: currentArticle.authorId,
        })
        .andWhere('article.id NOT IN (:...existingIds)', {
          existingIds: existingIds.length > 0 ? existingIds : [''],
        })
        .orderBy('article.publishedAt', 'DESC')
        .limit(remainingLimit)
        .getMany();

      articles.push(...authorArticles);
    }

    // 去重并限制数量
    const uniqueArticles = articles.filter(
      (article, index, self) =>
        index === self.findIndex((a) => a.id === article.id),
    );

    const result = uniqueArticles.slice(0, limit);

    // 批量加载标签信息
    if (result.length > 0) {
      await this.loadTagsForArticles(result);
    }

    return result;
  }

  /**
   * 创建基础查询构建器
   */
  private createBaseQueryBuilder(
    options: {
      includeCategory?: boolean;
      includeTags?: boolean;
      includeAuthor?: boolean;
      includeStats?: boolean;
    } = {},
  ): SelectQueryBuilder<Article> {
    const {
      includeCategory = true,
      includeTags = true,
      includeAuthor = true,
    } = options;

    const queryBuilder = this.articleRepository.createQueryBuilder('article');

    // 条件性加载关联数据，避免不必要的JOIN
    if (includeCategory) {
      queryBuilder.leftJoinAndSelect('article.category', 'category');
    }

    if (includeTags) {
      queryBuilder.leftJoinAndSelect('article.tags', 'tags');
    }

    if (includeAuthor) {
      queryBuilder.leftJoinAndSelect('article.author', 'author');
    }

    return queryBuilder;
  }

  /**
   * 创建优化的查询构建器，根据查询类型选择性加载关联数据
   */
  private createOptimizedQueryBuilder(
    queryType: 'list' | 'detail' | 'search' | 'stats',
    overrides?: {
      includeTags?: boolean;
      includeCategory?: boolean;
    },
  ): SelectQueryBuilder<Article> {
    switch (queryType) {
      case 'list':
        // 列表查询：根据用户请求动态决定是否包含标签和分类
        return this.createBaseQueryBuilder({
          includeCategory: overrides?.includeCategory ?? true,
          includeTags: overrides?.includeTags ?? false,
          includeAuthor: true,
          includeStats: true,
        });

      case 'detail':
        // 详情查询：加载所有关联数据
        return this.createBaseQueryBuilder({
          includeCategory: true,
          includeTags: true,
          includeAuthor: true,
          includeStats: true,
        });

      case 'search':
        // 搜索查询：根据用户请求动态决定是否包含标签和分类
        return this.createBaseQueryBuilder({
          includeCategory: overrides?.includeCategory ?? true,
          includeTags: overrides?.includeTags ?? false,
          includeAuthor: true,
          includeStats: false,
        });

      case 'stats':
        // 统计查询：只加载统计相关字段
        return this.articleRepository
          .createQueryBuilder('article')
          .select([
            'article.id',
            'article.title',
            'article.viewCount',
            'article.likeCount',
            'article.commentCount',
            'article.createdAt',
          ]);

      default:
        return this.createBaseQueryBuilder();
    }
  }

  /**
   * 应用过滤条件
   */
  private applyFilters(
    queryBuilder: SelectQueryBuilder<Article>,
    filters: Partial<ArticleQueryOptions>,
  ): void {
    const {
      status,
      categoryIds,
      tagIds,
      isFeatured,
      isTop,
      isVisible,
      keyword,
      year,
      month,
      publishedAtStart,
      publishedAtEnd,
    } = filters;

    // 调试日志：打印年月筛选参数
    if (year || month) {
      this.logger.log('年月筛选参数', {
        metadata: { year, month, filters },
      });
    }

    if (status) {
      queryBuilder.andWhere('article.status = :status', { status });
    }

    // 处理可见性筛选
    if (typeof isVisible === 'boolean') {
      // 如果明确指定了isVisible参数，使用该参数
      queryBuilder.andWhere('article.isVisible = :isVisibleFilter', {
        isVisibleFilter: isVisible,
      });
    } else if (status === ArticleStatus.PUBLISHED) {
      // 对于用户端查询已发布文章，默认只显示可见的文章
      queryBuilder.andWhere('article.isVisible = :isVisible', {
        isVisible: true,
      });
    }

    if (categoryIds && categoryIds.length > 0) {
      queryBuilder.andWhere('article.categoryId IN (:...categoryIds)', {
        categoryIds,
      });
    }

    if (tagIds && tagIds.length > 0) {
      // 检查是否已经join了tags表（包括leftJoin和leftJoinAndSelect）
      const joinAlias = queryBuilder.expressionMap.joinAttributes.find(
        (join) => join.alias.name === 'tags',
      );
      const selectAlias = queryBuilder.expressionMap.selects.find(
        (select) => select.aliasName === 'tags',
      );

      // 如果既没有join也没有select，则添加join
      if (!joinAlias && !selectAlias) {
        queryBuilder.leftJoin('article.tags', 'tags');
      }

      queryBuilder.andWhere('tags.id IN (:...tagIds)', { tagIds });
    }

    if (typeof isFeatured === 'boolean') {
      queryBuilder.andWhere('article.isFeatured = :isFeatured', { isFeatured });
    }

    if (typeof isTop === 'boolean') {
      queryBuilder.andWhere('article.isTop = :isTop', { isTop });
    }

    if (keyword) {
      queryBuilder.andWhere(
        '(article.title LIKE :keyword OR article.content LIKE :keyword OR article.summary LIKE :keyword)',
        { keyword: `%${keyword}%` },
      );
    }

    // 添加年份和月份过滤
    if (year) {
      queryBuilder.andWhere('YEAR(article.publishedAt) = :year', { year });
    }
    if (month) {
      queryBuilder.andWhere('MONTH(article.publishedAt) = :month', { month });
    }

    // 添加发布日期区间过滤
    if (publishedAtStart) {
      queryBuilder.andWhere('article.publishedAt >= :publishedAtStart', {
        publishedAtStart,
      });
    }
    if (publishedAtEnd) {
      queryBuilder.andWhere('article.publishedAt <= :publishedAtEnd', {
        publishedAtEnd,
      });
    }
  }
}
