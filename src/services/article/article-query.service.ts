import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Article } from '@/entities/article.entity';
import {
  ArticleQueryDto,
  ArticleStatus,
  ArticleSearchMode,
} from '@/dto/article.dto';
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

export interface CurrentUser {
  sub: string;
  username: string;
  email: string;
  role: string;
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
    currentUser?: CurrentUser,
  ): Promise<ArticleQueryResult> {
    const { page = 1, limit = 10 } = options;

    // 如果不使用缓存或没有缓存管理器，直接执行查询
    if (!useCache || !this.cacheManager) {
      return this.executeQuery(options);
    }

    // 对于管理员查询（包含非已发布状态的文章），不使用缓存
    // 因为管理员可以看到所有状态的文章，缓存会导致数据不一致
    if (!options.status || options.status !== ArticleStatus.PUBLISHED) {
      return this.executeQuery(options, currentUser);
    }

    // 对于有特殊过滤条件的查询，不使用缓存
    if (
      options.categoryIds ||
      options.tagIds ||
      options.isFeatured !== undefined ||
      options.isTop !== undefined ||
      options.keyword ||
      options.year ||
      options.month ||
      options.sortBy ||
      options.sortOrder
    ) {
      return this.executeQuery(options, currentUser);
    }

    // 只对简单的已发布文章列表查询使用缓存
    const cached = await this.cacheManager.getArticleList(page, limit);
    if (cached) {
      return cached as ArticleQueryResult;
    }

    // 执行查询并缓存结果
    const result = await this.executeQuery(options, currentUser);
    await this.cacheManager.setArticleList(result, page, limit);

    return result;
  }

  /**
   * 执行实际的查询逻辑
   */
  private async executeQuery(
    options: ArticleQueryOptions,
    currentUser?: CurrentUser,
  ): Promise<ArticleQueryResult> {
    const {
      page = 1,
      limit = 10,
      tagIds,
      sortBy = 'publishedAt',
      sortOrder = 'DESC',
    } = options;

    const skip = PaginationUtil.calculateSkip(page, limit);

    // 使用优化的查询构建器，始终包含标签和分类
    const queryBuilder = this.createOptimizedQueryBuilder('list');

    // 应用过滤条件
    // 判断是否为管理员查询：根据用户角色判断
    const isAdminQuery = currentUser?.role === 'admin';
    this.applyFilters(queryBuilder, options, isAdminQuery);

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

    return { items, total };
  }

  /**
   * 通用的缓存查询方法
   */
  private async executeWithCache(
    getCacheMethod: () => Promise<ArticleQueryResult | null>,
    setCacheMethod: (data: ArticleQueryResult) => Promise<void>,
    queryOptions: ArticleQueryOptions,
  ): Promise<ArticleQueryResult> {
    // 如果不使用缓存，直接执行查询
    if (!this.cacheManager) {
      return this.executeQuery(queryOptions);
    }

    // 尝试从缓存获取数据
    const cached = await getCacheMethod();
    if (cached) {
      return cached;
    }

    // 执行查询并缓存结果
    const result = await this.executeQuery(queryOptions);
    await setCacheMethod(result);

    return result;
  }

  /**
   * 获取热门文章
   */
  async getPopularArticles(
    options: ArticleQueryOptions = {},
  ): Promise<ArticleQueryResult> {
    const queryOptions: ArticleQueryOptions = {
      ...options,
      status: ArticleStatus.PUBLISHED,
      sortBy: 'viewCount',
      sortOrder: 'DESC',
    };

    return this.executeWithCache(
      () =>
        this.cacheManager.getPopularArticles() as Promise<ArticleQueryResult | null>,
      (data) => this.cacheManager.setPopularArticles(data),
      queryOptions,
    );
  }

  /**
   * 获取最新文章
   */
  async getRecentArticles(
    options: ArticleQueryOptions = {},
  ): Promise<ArticleQueryResult> {
    const queryOptions: ArticleQueryOptions = {
      ...options,
      status: ArticleStatus.PUBLISHED,
      sortBy: 'publishedAt',
      sortOrder: 'DESC',
    };
    return this.executeWithCache(
      () =>
        this.cacheManager.getRecentArticles() as Promise<ArticleQueryResult | null>,
      (data) => this.cacheManager.setRecentArticles(data),
      queryOptions,
    );
  }

  /**
   * 获取精选文章
   */
  async getFeaturedArticles(
    options: ArticleQueryOptions = {},
  ): Promise<ArticleQueryResult> {
    const queryOptions: ArticleQueryOptions = {
      ...options,
      status: ArticleStatus.PUBLISHED,
      isFeatured: true,
      sortBy: 'publishedAt',
      sortOrder: 'DESC',
    };

    return this.executeWithCache(
      () =>
        this.cacheManager.getFeaturedArticles() as Promise<ArticleQueryResult | null>,
      (data) => this.cacheManager.setFeaturedArticles(data),
      queryOptions,
    );
  }

  /**
   * 搜索文章（优化版）
   */
  async searchArticles(
    keyword: string,
    options: Omit<ArticleQueryOptions, 'keyword'> & {
      searchMode?: ArticleSearchMode;
    } = {},
    currentUser?: CurrentUser,
  ): Promise<ArticleQueryResult> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'publishedAt',
      sortOrder = 'DESC',
    } = options;
    const skip = PaginationUtil.calculateSkip(page, limit);

    // 使用搜索优化的查询构建器，始终包含标签和分类
    const queryBuilder = this.createOptimizedQueryBuilder('search');

    // 应用搜索条件（优化：使用全文搜索或更高效的LIKE查询）
    queryBuilder
      .where('article.status = :status', { status: 'published' })
      .andWhere('article.isVisible = :isVisible', { isVisible: true });

    // 应用所有过滤条件，包括关键词搜索
    // 搜索接口强制只返回已发布文章，所以这是用户端查询
    const isAdminQuery = currentUser?.role === 'admin';
    this.applyFilters(queryBuilder, { ...options, keyword }, isAdminQuery);

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
    currentUser?: CurrentUser,
  ): Promise<ArticleQueryResult> {
    const skip = PaginationUtil.calculateSkip(page, limit);

    const queryBuilder = this.createOptimizedQueryBuilder('list');

    // 使用统一的过滤方法
    // 归档接口强制只返回已发布文章，所以这是用户端查询
    const isAdminQuery = currentUser?.role === 'admin';
    this.applyFilters(
      queryBuilder,
      {
        status: ArticleStatus.PUBLISHED,
        isVisible: true,
        year,
        month,
      },
      isAdminQuery,
    );

    queryBuilder.orderBy('article.updatedAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();

    return { items, total };
  }

  /**
   * 获取归档统计数据
   * 只统计年月的总文章数，不关联分类和标签
   */
  async getArchiveStats(): Promise<
    { year: number; month: number; count: number }[]
  > {
    const result = await this.articleRepository
      .createQueryBuilder('article')
      .select('YEAR(article.publishedAt)', 'year')
      .addSelect('MONTH(article.publishedAt)', 'month')
      .addSelect('COUNT(article.id)', 'count')
      .where('article.publishedAt IS NOT NULL')
      .andWhere('article.status = :status', { status: ArticleStatus.PUBLISHED })
      .andWhere('article.isVisible = :isVisible', { isVisible: true })
      .groupBy('year, month')
      .orderBy('year', 'DESC')
      .addOrderBy('month', 'DESC')
      .getRawMany();

    return result.map(
      (item: {
        year: string | number;
        month: number | string;
        count: string | number;
      }) => ({
        year: parseInt(item.year as string),
        month: parseInt(item.month as string),
        count: parseInt(item.count as string),
      }),
    );
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
          SELECT 1 FROM article_tags att 
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

    // 如果相关文章不够，补充其他同类型文章
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
      selectOnly?: string[];
    } = {},
  ): SelectQueryBuilder<Article> {
    const {
      includeCategory = true,
      includeTags = true,
      includeAuthor = true,
      selectOnly,
    } = options;

    const queryBuilder = this.articleRepository.createQueryBuilder('article');

    // 如果指定了selectOnly，只选择特定字段
    if (selectOnly) {
      queryBuilder.select(selectOnly);
      return queryBuilder;
    }

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
   * 查询类型配置映射
   */
  private static readonly QUERY_TYPE_CONFIGS = {
    list: {
      includeCategory: true,
      includeTags: true,
      includeAuthor: true,
      includeStats: true,
    },
    detail: {
      includeCategory: true,
      includeTags: true,
      includeAuthor: true,
      includeStats: true,
    },
    search: {
      includeCategory: true,
      includeTags: true,
      includeAuthor: true,
      includeStats: false,
    },
    stats: {
      includeCategory: false,
      includeTags: false,
      includeAuthor: false,
      includeStats: false,
      selectOnly: [
        'article.id',
        'article.title',
        'article.viewCount',
        'article.likeCount',
        'article.commentCount',
        'article.createdAt',
      ] as string[],
    },
  } as const;

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
    const config = ArticleQueryService.QUERY_TYPE_CONFIGS[queryType];

    // 应用覆盖配置
    const finalConfig = {
      ...config,
      includeCategory: overrides?.includeCategory ?? config.includeCategory,
      includeTags: overrides?.includeTags ?? config.includeTags,
    };

    return this.createBaseQueryBuilder(finalConfig);
  }

  /**
   * 应用过滤条件
   */
  private applyFilters(
    queryBuilder: SelectQueryBuilder<Article>,
    filters: Partial<ArticleQueryOptions>,
    isAdminQuery: boolean = false,
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
      // 根据搜索模式进行不同的搜索
      if (filters.searchMode === ArticleSearchMode.TITLE) {
        queryBuilder.andWhere('article.title LIKE :keyword', {
          keyword: `%${keyword}%`,
        });
      } else if (filters.searchMode === ArticleSearchMode.SUMMARY) {
        queryBuilder.andWhere('article.summary LIKE :keyword', {
          keyword: `%${keyword}%`,
        });
      } else if (filters.searchMode === ArticleSearchMode.CONTENT) {
        queryBuilder.andWhere('article.content LIKE :keyword', {
          keyword: `%${keyword}%`,
        });
      } else {
        // 默认混合搜索
        queryBuilder.andWhere(
          '(article.title LIKE :keyword OR article.content LIKE :keyword OR article.summary LIKE :keyword)',
          { keyword: `%${keyword}%` },
        );
      }
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

    // 对于非管理员查询，需要确保关联的分类和标签都是活跃状态
    if (!isAdminQuery) {
      // 检查分类是否活跃（如果文章有分类）
      const categoryJoinAlias = queryBuilder.expressionMap.joinAttributes.find(
        (join) => join.alias.name === 'category',
      );
      const categorySelectAlias = queryBuilder.expressionMap.selects.find(
        (select) => select.aliasName === 'category',
      );

      if (categoryJoinAlias || categorySelectAlias) {
        // 如果已经join了category表，直接添加条件
        queryBuilder.andWhere(
          '(article.categoryId IS NULL OR category.isActive = :categoryIsActive)',
          { categoryIsActive: true },
        );
      } else {
        // 如果没有join category表，需要添加join
        queryBuilder.leftJoin('article.category', 'category');
        queryBuilder.andWhere(
          '(article.categoryId IS NULL OR category.isActive = :categoryIsActive)',
          { categoryIsActive: true },
        );
      }

      // 检查标签是否活跃（如果文章有标签）
      const tagJoinAlias = queryBuilder.expressionMap.joinAttributes.find(
        (join) => join.alias.name === 'tags',
      );
      const tagSelectAlias = queryBuilder.expressionMap.selects.find(
        (select) => select.aliasName === 'tags',
      );

      if (tagJoinAlias || tagSelectAlias) {
        // 如果已经join了tags表，直接添加条件
        queryBuilder.andWhere(
          '(NOT EXISTS (SELECT 1 FROM article_tags att WHERE att.articleId = article.id) OR tags.isActive = :tagIsActive)',
          { tagIsActive: true },
        );
      } else {
        // 如果没有join tags表，需要添加join
        queryBuilder.leftJoin('article.tags', 'tags');
        queryBuilder.andWhere(
          '(NOT EXISTS (SELECT 1 FROM article_tags att WHERE att.articleId = article.id) OR tags.isActive = :tagIsActive)',
          { tagIsActive: true },
        );
      }
    }
  }
}
