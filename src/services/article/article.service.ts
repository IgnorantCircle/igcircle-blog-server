import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { ConflictException } from '@/common/exceptions/business.exception';
import { ErrorCode } from '@/common/constants/error-codes';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Not } from 'typeorm';
import { Article } from '@/entities/article.entity';
import { Tag } from '@/entities/tag.entity';
import {
  CreateArticleDto,
  UpdateArticleDto,
  ArticleQueryDto,
} from '@/dto/article.dto';
import { BaseService } from '@/common/base/base.service';
import { SlugUtil } from '@/common/utils/slug.util';
import { ArticleStatisticsService } from './article-statistics.service';
import {
  ArticleQueryService,
  ArticleQueryOptions,
} from './article-query.service';
import { ArticleStatusService } from './article-status.service';
import { CACHE_TYPES } from '@/common/cache/cache.config';
import { CacheService } from '@/common/cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';

@Injectable()
export class ArticleService extends BaseService<Article> {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    private readonly dataSource: DataSource,
    @Inject(ArticleStatisticsService)
    private readonly articleStatisticsService: ArticleStatisticsService,
    @Inject(ArticleQueryService)
    private readonly articleQueryService: ArticleQueryService,
    @Inject(ArticleStatusService)
    private readonly articleStatusService: ArticleStatusService,
    @Inject(CacheService) cacheService: CacheService,
    @Inject(ConfigService) configService: ConfigService,
    @Inject(StructuredLoggerService) logger: StructuredLoggerService,
  ) {
    super(articleRepository, 'article', cacheService, configService, logger);
  }

  // 创建文章
  async create(createArticleDto: CreateArticleDto): Promise<Article>;
  async create(entityData: Partial<Article>): Promise<Article>;
  async create(
    createDataOrDto: CreateArticleDto | Partial<Article>,
  ): Promise<Article> {
    // 检查是否为CreateArticleDto类型
    const isCreateDto = 'tagIds' in createDataOrDto;

    if (isCreateDto) {
      const createArticleDto = createDataOrDto;
      const { tagIds, ...articleData } = createArticleDto;

      // 检查slug是否已存在
      let finalSlug = articleData.slug;
      if (!finalSlug) {
        finalSlug = SlugUtil.forArticle(articleData.title);
      }

      const existingArticle = await this.articleRepository.findOne({
        where: { slug: finalSlug },
      });

      if (existingArticle) {
        throw new ConflictException(ErrorCode.ARTICLE_SLUG_EXISTS);
      }

      return this.dataSource.transaction(async (manager) => {
        // 设置默认状态
        const status = articleData.status || 'draft';

        // 构建文章创建数据
        const articleCreateData: any = {
          ...articleData,
          slug: finalSlug,
          status,
        };

        const article = manager.create(Article, articleCreateData);

        // 处理标签关联
        if (tagIds && tagIds.length > 0) {
          const tags = await manager.getRepository(Tag).find({
            where: { id: In(tagIds) },
          });
          article.tags = tags;
        }

        const savedArticle = await manager.save(article);

        // 缓存文章
        await Promise.all([
          this.cacheService.set(savedArticle.id, savedArticle, {
            type: CACHE_TYPES.ARTICLE,
          }),
          this.cacheService.set(`slug:${savedArticle.slug}`, savedArticle, {
            type: CACHE_TYPES.ARTICLE,
          }),
        ]);

        return savedArticle;
      });
    } else {
      const entityData = createDataOrDto as Partial<Article>;
      const article = this.repository.create(entityData);
      const savedArticle = await this.repository.save(article);

      // 缓存文章
      if (savedArticle.id && savedArticle.slug) {
        await Promise.all([
          this.cacheService.set(savedArticle.id, savedArticle, {
            type: CACHE_TYPES.ARTICLE,
          }),
          this.cacheService.set(`slug:${savedArticle.slug}`, savedArticle, {
            type: CACHE_TYPES.ARTICLE,
          }),
        ]);
      }

      return savedArticle;
    }
  }

  // 根据ID查找文章
  async findById(id: string, useCache: boolean = true): Promise<Article> {
    if (useCache) {
      const cached = await this.cacheService.get<Article>(id, {
        type: this.entityName,
      });
      if (cached) {
        return cached;
      }
    }

    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ['author', 'tags', 'category'],
    });

    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    if (useCache) {
      await this.cacheService.set(id, article, {
        type: CACHE_TYPES.ARTICLE,
      });
    }

    return article;
  }

  async findBySlug(slug: string): Promise<Article> {
    // 先尝试从缓存获取
    const cached = await this.cacheService.get<Article>(`slug:${slug}`, {
      type: CACHE_TYPES.ARTICLE,
    });
    if (cached) {
      return cached;
    }

    const article = await this.articleRepository.findOne({
      where: { slug },
      relations: ['author', 'tags', 'category'],
    });

    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    // 缓存文章（同时缓存ID和slug）
    await Promise.all([
      this.cacheService.set(article.id, article, {
        type: CACHE_TYPES.ARTICLE,
      }),
      this.cacheService.set(`slug:${slug}`, article, {
        type: CACHE_TYPES.ARTICLE,
      }),
    ]);

    return article;
  }

  async findAllPaginated(
    query: ArticleQueryDto,
  ): Promise<{ items: Article[]; total: number }> {
    const options: ArticleQueryOptions = {
      page: query.page,
      limit: query.limit,
      status: query.status,
      categoryIds: query.categoryIds,
      tagIds: query.tagIds,
      authorId: query.authorId,
      isFeatured: query.isFeatured,
      isTop: query.isTop,
      keyword: query.keyword,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'DESC',
    };

    return this.articleQueryService.findAllPaginated(options);
  }

  // 更新文章
  async update(id: string, updateData: Partial<Article>): Promise<Article>;
  async update(
    id: string,
    updateArticleDto: UpdateArticleDto,
  ): Promise<Article>;
  async update(
    id: string,
    updateDataOrDto: Partial<Article> | UpdateArticleDto,
  ): Promise<Article> {
    const article = await this.findById(id, false);

    // 判断是否为UpdateArticleDto类型
    const isUpdateDto =
      'tagIds' in updateDataOrDto || 'categoryIds' in updateDataOrDto;

    let updatedArticle: Article;

    if (isUpdateDto) {
      const updateArticleDto = updateDataOrDto;

      // 检查slug冲突
      if (updateArticleDto.slug && updateArticleDto.slug !== article.slug) {
        const existingArticle = await this.articleRepository.findOne({
          where: { slug: updateArticleDto.slug, id: Not(id) },
        });
        if (existingArticle) {
          throw new ConflictException(ErrorCode.ARTICLE_SLUG_EXISTS);
        }
      }

      // 处理标签关联
      if (updateArticleDto.tagIds !== undefined) {
        if (updateArticleDto.tagIds.length > 0) {
          const tags = await this.dataSource.getRepository(Tag).find({
            where: { id: In(updateArticleDto.tagIds) },
          });
          article.tags = tags;
        } else {
          article.tags = [];
        }
      }

      // 限制作者只能修改特定字段
      const allowedFields = [
        'title',
        'summary',
        'content',
        'slug',
        'coverImage',
        'metaDescription',
        'metaKeywords',
        'socialImage',
        'allowComments',
        'categoryId',
      ];

      const filteredUpdateData: { [key: string]: any } = {};
      for (const field of allowedFields) {
        if (
          updateArticleDto[field as keyof typeof updateArticleDto] !== undefined
        ) {
          filteredUpdateData[field] =
            updateArticleDto[field as keyof typeof updateArticleDto];
        }
      }

      updatedArticle = this.repository.merge(article, filteredUpdateData);
    } else {
      // 直接使用Partial<Article>类型
      updatedArticle = this.repository.merge(
        article,
        updateDataOrDto as Partial<Article>,
      );
    }

    const savedArticle = await this.repository.save(updatedArticle);

    // 更新缓存（包含slug缓存）
    await Promise.all([
      this.cacheService.set(savedArticle.id, savedArticle, {
        type: CACHE_TYPES.ARTICLE,
      }),
      this.cacheService.set(`slug:${savedArticle.slug}`, savedArticle, {
        type: CACHE_TYPES.ARTICLE,
      }),
    ]);

    return savedArticle;
  }

  async publish(
    id: string,
    publishDto?: { publishedAt?: Date },
  ): Promise<Article> {
    return this.articleStatusService.publish(id, publishDto);
  }

  async incrementViews(id: string): Promise<void> {
    return this.articleStatisticsService.incrementViews(id);
  }

  async like(id: string): Promise<void> {
    return this.articleStatisticsService.like(id);
  }

  async remove(id: string): Promise<void> {
    const article = await this.findById(id);
    await this.articleRepository.softDelete(id);

    // 清除缓存
    await this.clearArticleCache(id, article.slug);

    // 清除相关缓存
    await this.cacheService.clearCacheByPattern('articles:*');
    await this.cacheService.clearCacheByPattern('article:stats:*');
  }

  async getPopular(limit: number = 10): Promise<Article[]> {
    const result = await this.articleQueryService.getPopularArticles({ limit });
    return result.items;
  }

  async getRecent(limit: number = 10): Promise<Article[]> {
    const result = await this.articleQueryService.getRecentArticles({ limit });
    return result.items;
  }

  async getStatistics(): Promise<{
    total: number;
    published: number;
    draft: number;
    archived: number;
  }> {
    return this.articleStatisticsService.getStatistics();
  }

  async unpublish(id: string): Promise<Article> {
    return this.articleStatusService.unpublish(id);
  }

  async archive(id: string): Promise<Article> {
    return this.articleStatusService.archive(id);
  }

  async toggleFeature(id: string): Promise<Article> {
    const article = await this.findById(id);
    return this.articleStatusService.setFeatured(id, !article.isFeatured);
  }

  async toggleTop(id: string): Promise<Article> {
    const article = await this.findById(id);
    return this.articleStatusService.setTop(id, !article.isTop);
  }

  async toggleVisible(id: string): Promise<Article> {
    return this.articleStatusService.toggleVisibility(id);
  }

  async batchRemove(ids: string[]): Promise<void> {
    await this.articleRepository.delete(ids);

    // 清除缓存
    for (const id of ids) {
      await this.clearArticleCache(id);
    }
  }

  async batchPublish(ids: string[]): Promise<void> {
    return this.articleStatusService.batchPublish(ids);
  }

  async batchArchive(ids: string[]): Promise<void> {
    return this.articleStatusService.batchArchive(ids);
  }

  async getFeatured(limit: number = 10): Promise<Article[]> {
    const result = await this.articleQueryService.getFeaturedArticles({
      limit,
    });
    return result.items;
  }

  async search(searchDto: {
    q: string;
    page?: number;
    limit?: number;
  }): Promise<{ articles: Article[]; total: number }> {
    const { q, page = 1, limit = 10 } = searchDto;
    const result = await this.articleQueryService.searchArticles(q, {
      page,
      limit,
    });
    return {
      articles: result.items,
      total: result.total,
    };
  }

  async getRelated(id: string, limit: number = 5): Promise<Article[]> {
    return this.articleQueryService.getRelatedArticles(id, limit);
  }

  async share(id: string): Promise<void> {
    return this.articleStatisticsService.share(id);
  }

  async findByIdAndAuthor(id: string, authorId: string): Promise<Article> {
    const article = await this.articleRepository.findOne({
      where: { id, authorId },
      relations: ['author', 'tags', 'category'],
    });

    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    return article;
  }

  async updateByAuthor(
    id: string,
    authorId: string,
    updateArticleDto: UpdateArticleDto,
  ): Promise<Article> {
    const article = await this.findByIdAndAuthor(id, authorId);

    // 检查slug冲突
    if (updateArticleDto.slug && updateArticleDto.slug !== article.slug) {
      const existingArticle = await this.articleRepository.findOne({
        where: { slug: updateArticleDto.slug, id: Not(id) },
      });
      if (existingArticle) {
        throw new ConflictException(ErrorCode.ARTICLE_SLUG_EXISTS);
      }
    }

    // 处理标签关联
    if (updateArticleDto.tagIds !== undefined) {
      if (updateArticleDto.tagIds.length > 0) {
        const tags = await this.dataSource.getRepository(Tag).find({
          where: { id: In(updateArticleDto.tagIds) },
        });
        article.tags = tags;
      } else {
        article.tags = [];
      }
    }

    // 限制作者只能修改特定字段
    const allowedFields = [
      'title',
      'summary',
      'content',
      'slug',
      'coverImage',
      'metaDescription',
      'metaKeywords',
      'socialImage',
      'allowComments',
      'categoryId',
    ];

    const filteredUpdateData: { [key: string]: any } = {};
    for (const field of allowedFields) {
      if (
        updateArticleDto[field as keyof typeof updateArticleDto] !== undefined
      ) {
        filteredUpdateData[field] =
          updateArticleDto[field as keyof typeof updateArticleDto];
      }
    }

    const updatedArticle = this.repository.merge(article, filteredUpdateData);
    const savedArticle = await this.repository.save(updatedArticle);

    // 更新缓存
    await Promise.all([
      this.cacheService.set(savedArticle.id, savedArticle, {
        type: CACHE_TYPES.ARTICLE,
      }),
      this.cacheService.set(`slug:${savedArticle.slug}`, savedArticle, {
        type: CACHE_TYPES.ARTICLE,
      }),
    ]);

    return savedArticle;
  }

  async publishByAuthor(
    id: string,
    authorId: string,
    publishDto?: { publishedAt?: Date },
  ): Promise<Article> {
    return this.articleStatusService.publishByAuthor(id, authorId, publishDto);
  }

  async removeByAuthor(id: string, authorId: string): Promise<void> {
    return this.articleStatusService.removeByAuthor(id, authorId);
  }

  private async clearArticleCache(id: string, slug?: string): Promise<void> {
    const promises = [this.cacheService.del(id)];

    if (slug) {
      promises.push(this.cacheService.del(`slug:${slug}`));
    }

    // 清除相关的列表缓存
    promises.push(
      this.cacheService.clearCacheByPattern('articles:*'),
      this.cacheService.clearCacheByPattern('article:stats:*'),
    );

    try {
      await Promise.all(promises);
    } catch (error) {
      this.logger.warn('清除文章缓存失败', {
        metadata: { articleId: id, slug, error: error as string },
      });
    }
  }

  // 获取文章的浏览历史统计
  async getViewHistory(
    id: string,
    days: number = 30,
  ): Promise<{ date: string; views: number }[]> {
    return this.articleStatisticsService.getViewHistory(id, days);
  }

  // 获取热门标签（基于文章数量）
  async getPopularTags(limit: number = 10): Promise<any[]> {
    return this.articleStatisticsService.getPopularTags(limit);
  }

  // 获取文章阅读时长统计
  async getReadingTimeStats(): Promise<{
    average: number;
    distribution: { range: string; count: number }[];
  }> {
    return this.articleStatisticsService.getReadingTimeStats();
  }
}
