import { Injectable, Inject } from '@nestjs/common';
import {
  NotFoundException,
  ConflictException,
} from '@/common/exceptions/business.exception';
import { ErrorCode } from '@/common/constants/error-codes';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, DataSource, In } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Article } from '@/entities/article.entity';
import { Tag } from '@/entities/tag.entity';
import {
  CreateArticleDto,
  UpdateArticleDto,
  ArticleQueryDto,
} from '@/dto/article.dto';
import { BaseService } from '@/common/base/base.service';
import { CacheStrategyService } from '@/common/cache/cache-strategy.service';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';
import { ConfigService } from '@nestjs/config';

// 定义数据库错误接口
interface DatabaseError {
  code?: string;
  errno?: number;
}

@Injectable()
export class ArticleService extends BaseService<Article> {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly dataSource: DataSource,
    protected readonly cacheStrategy: CacheStrategyService,
    protected readonly logger: StructuredLoggerService,
    protected readonly configService: ConfigService,
  ) {
    super(articleRepository, cacheStrategy, 'article', configService);
    this.logger.setContext({ module: 'ArticleService' });
  }

  /**
   * 创建文章（重写BaseService的create方法以处理特殊逻辑）
   */
  async create(createArticleDto: CreateArticleDto): Promise<Article> {
    const { status = 'draft', slug, tagIds, ...articleData } = createArticleDto;

    // 使用事务确保数据一致性
    return await this.dataSource.transaction(async (manager) => {
      // 生成或验证 slug
      let finalSlug = slug;
      if (!finalSlug) {
        finalSlug = this.generateSlug(articleData.title);
      }

      // 检查slug是否已存在
      const existingArticle = await manager.findOne(Article, {
        where: { slug: finalSlug },
      });
      if (existingArticle) {
        throw new ConflictException(ErrorCode.ARTICLE_SLUG_EXISTS);
      }

      try {
        const articleCreateData: any = {
          ...articleData,
          slug: finalSlug,
          status,
        };

        // 只在有值时才设置时间戳字段
        if (articleData.createdAt !== undefined) {
          articleCreateData.createdAt = articleData.createdAt;
        }
        if (articleData.updatedAt !== undefined) {
          articleCreateData.updatedAt = articleData.updatedAt;
        }

        const article = manager.create(Article, articleCreateData);

        // 处理标签关联
        if (tagIds && tagIds.length > 0) {
          const tags = await manager.getRepository(Tag).find({
            where: { id: In(tagIds) },
          });
          article.tags = tags;
        }

        const savedArticle = await manager.save(article);

        // 使用统一的缓存策略（包含slug缓存）
        await Promise.all([
          this.cacheStrategy.set(savedArticle.id, savedArticle, {
            type: this.entityName,
            ttl: this.cacheOptions.ttl,
          }),
          this.cacheStrategy.set(`slug:${savedArticle.slug}`, savedArticle, {
            type: this.entityName,
            ttl: this.cacheOptions.ttl,
          }),
        ]);

        return savedArticle;
      } catch (error: unknown) {
        const dbError = error as DatabaseError;
        if (dbError?.code === 'ER_DUP_ENTRY' || dbError?.errno === 1062) {
          throw new ConflictException(ErrorCode.ARTICLE_SLUG_EXISTS);
        }
        throw error;
      }
    });
  }
  /**
   * 根据ID查找文章（重写BaseService方法以包含关联数据）
   */
  async findById(id: string, useCache: boolean = true): Promise<Article> {
    if (useCache) {
      const cached = await this.cacheStrategy.get<Article>(id, {
        type: this.entityName,
      });
      if (cached) {
        return cached;
      }
    }

    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ['author', 'category', 'tags'],
    });

    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    if (useCache) {
      await this.cacheStrategy.set(id, article, {
        type: this.entityName,
        ttl: this.cacheOptions.ttl,
      });
    }

    return article;
  }

  async findBySlug(slug: string): Promise<Article> {
    // 使用统一的缓存策略，以slug为键
    const cached = await this.cacheStrategy.get<Article>(`slug:${slug}`, {
      type: 'article',
    });
    if (cached) {
      return cached;
    }

    const article = await this.articleRepository.findOne({
      where: { slug },
      relations: ['author', 'category', 'tags'],
    });

    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    // 缓存文章，同时缓存ID和slug两个键
    await Promise.all([
      this.cacheStrategy.set(article.id, article, {
        type: 'article',
        ttl: 600,
      }),
      this.cacheStrategy.set(`slug:${slug}`, article, {
        type: 'article',
        ttl: 600,
      }),
    ]);

    return article;
  }

  async findAll(
    query: ArticleQueryDto,
  ): Promise<{ items: Article[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      status,
      tagId,
      keyword,
      startDate,
      endDate,
      isVisible,
    } = query;

    const queryBuilder = this.articleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author')
      .leftJoinAndSelect('article.category', 'category')
      .leftJoinAndSelect('article.tags', 'tags')
      .where('article.deletedAt IS NULL')
      .orderBy('article.createdAt', 'DESC');

    if (status) {
      queryBuilder.andWhere('article.status = :status', { status });
    }

    if (tagId) {
      queryBuilder.andWhere('tags.id = :tagId', { tagId });
    }

    if (keyword) {
      queryBuilder.andWhere(
        '(article.title LIKE :keyword OR article.summary LIKE :keyword)',
        { keyword: `%${keyword}%` },
      );
    }

    if (startDate) {
      queryBuilder.andWhere('article.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('article.createdAt <= :endDate', { endDate });
    }

    if (isVisible !== undefined) {
      queryBuilder.andWhere('article.isVisible = :isVisible', { isVisible });
    }

    const [articles, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { items: articles, total };
  }

  /**
   * 更新文章（重写BaseService方法以处理特殊逻辑）
   */
  async update(
    id: string,
    updateArticleDto: UpdateArticleDto,
  ): Promise<Article> {
    const article = await this.findById(id, false);

    // 如果更新了slug，检查新slug是否已存在
    if (updateArticleDto.slug && updateArticleDto.slug !== article.slug) {
      const existingArticle = await this.articleRepository.findOne({
        where: { slug: updateArticleDto.slug, id: Not(id) },
      });
      if (existingArticle) {
        throw new ConflictException(ErrorCode.ARTICLE_SLUG_EXISTS);
      }
    }

    // 处理标签更新
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

    // 移除 tagIds，因为它不是 Article 实体的属性
    const { tagIds, ...updateData } = updateArticleDto;

    const updatedArticle = this.repository.merge(article, updateData);
    const savedArticle = await this.repository.save(updatedArticle);

    // 更新缓存（包含slug缓存）
    await Promise.all([
      this.cacheStrategy.set(savedArticle.id, savedArticle, {
        type: this.entityName,
        ttl: this.cacheOptions.ttl,
      }),
      this.cacheStrategy.set(`slug:${savedArticle.slug}`, savedArticle, {
        type: this.entityName,
        ttl: this.cacheOptions.ttl,
      }),
    ]);

    return savedArticle;
  }

  async publish(
    id: string,
    publishDto?: { publishedAt?: Date },
  ): Promise<Article> {
    const article = await this.findById(id);

    article.status = 'published';
    article.publishedAt = publishDto?.publishedAt
      ? publishDto.publishedAt
      : new Date();

    const publishedArticle = await this.articleRepository.save(article);

    // 使用统一的缓存策略缓存文章
    await Promise.all([
      this.cacheStrategy.set(publishedArticle.id, publishedArticle, {
        type: 'article',
        ttl: 600,
      }),
      this.cacheStrategy.set(
        `slug:${publishedArticle.slug}`,
        publishedArticle,
        {
          type: 'article',
          ttl: 600,
        },
      ),
    ]);

    return publishedArticle;
  }

  async incrementViews(id: string): Promise<void> {
    await this.articleRepository.increment({ id }, 'viewCount', 1);

    // 清除缓存，下次访问时重新加载
    await this.clearArticleCache(id);
  }

  async like(id: string): Promise<void> {
    await this.articleRepository.increment({ id }, 'likeCount', 1);

    // 清除缓存
    await this.clearArticleCache(id);
  }

  /**
   * 删除文章（重写BaseService方法以清除slug缓存）
   */
  async remove(id: string): Promise<void> {
    const article = await this.findById(id, false);

    // 使用BaseService的软删除
    await this.softRemove(id);

    // 额外清除slug缓存
    await this.cacheStrategy.del(`slug:${article.slug}`, {
      type: this.entityName,
    });
  }

  async getPopular(limit: number = 10): Promise<Article[]> {
    // 使用统一的缓存策略
    const cached = await this.cacheStrategy.get<Article[]>(`popular:${limit}`, {
      type: 'article',
    });
    if (cached) {
      return cached;
    }

    const articles = await this.articleRepository.find({
      where: { status: 'published', isVisible: true },
      order: { likeCount: 'DESC', viewCount: 'DESC' },
      take: limit,
      relations: ['author', 'category', 'tags'],
    });

    // 使用统一的缓存策略，缓存1小时
    await this.cacheStrategy.set(`popular:${limit}`, articles, {
      type: 'article',
      ttl: 3600,
    });
    return articles;
  }

  // 获取最新文章
  async getRecent(limit: number = 10): Promise<Article[]> {
    // 使用统一的缓存策略
    const cached = await this.cacheStrategy.get<Article[]>(`recent:${limit}`, {
      type: 'article',
    });
    if (cached) {
      return cached;
    }

    const articles = await this.articleRepository.find({
      where: { status: 'published', isVisible: true },
      order: { publishedAt: 'DESC' },
      take: limit,
      relations: ['author', 'category', 'tags'],
    });

    // 使用统一的缓存策略，缓存1小时
    await this.cacheStrategy.set(`recent:${limit}`, articles, {
      type: 'article',
      ttl: 3600,
    });
    return articles;
  }

  // 获取文章统计信息
  async getStatistics(): Promise<any> {
    const total = await this.articleRepository.count();
    const published = await this.articleRepository.count({
      where: { status: 'published' },
    });
    const draft = await this.articleRepository.count({
      where: { status: 'draft' },
    });
    const archived = await this.articleRepository.count({
      where: { status: 'archived' },
    });

    return {
      total,
      published,
      draft,
      archived,
    };
  }

  async unpublish(id: string): Promise<Article> {
    const article = await this.findById(id);

    article.status = 'draft';
    article.publishedAt = null;

    const updatedArticle = await this.articleRepository.save(article);

    // 使用统一的缓存策略缓存文章
    await Promise.all([
      this.cacheStrategy.set(updatedArticle.id, updatedArticle, {
        type: 'article',
        ttl: 600,
      }),
      this.cacheStrategy.set(`slug:${updatedArticle.slug}`, updatedArticle, {
        type: 'article',
        ttl: 600,
      }),
    ]);

    return updatedArticle;
  }

  async archive(id: string): Promise<Article> {
    const article = await this.findById(id);

    article.status = 'archived';

    const archivedArticle = await this.articleRepository.save(article);

    // 使用统一的缓存策略缓存文章
    await Promise.all([
      this.cacheStrategy.set(archivedArticle.id, archivedArticle, {
        type: 'article',
        ttl: 600,
      }),
      this.cacheStrategy.set(`slug:${archivedArticle.slug}`, archivedArticle, {
        type: 'article',
        ttl: 600,
      }),
    ]);

    return archivedArticle;
  }

  async toggleFeature(id: string): Promise<Article> {
    const article = await this.findById(id);

    article.isFeatured = !article.isFeatured;

    const updatedArticle = await this.articleRepository.save(article);

    // 使用统一的缓存策略缓存文章
    await Promise.all([
      this.cacheStrategy.set(updatedArticle.id, updatedArticle, {
        type: 'article',
        ttl: this.configService.get('cache.ttl.article') || 600,
      }),
      this.cacheStrategy.set(`slug:${updatedArticle.slug}`, updatedArticle, {
        type: 'article',
        ttl: this.configService.get('cache.ttl.article') || 600,
      }),
    ]);

    return updatedArticle;
  }

  async toggleTop(id: string): Promise<Article> {
    const article = await this.findById(id);

    article.isTop = !article.isTop;

    const updatedArticle = await this.articleRepository.save(article);

    // 使用统一的缓存策略缓存文章
    await Promise.all([
      this.cacheStrategy.set(updatedArticle.id, updatedArticle, {
        type: 'article',
        ttl: 600,
      }),
      this.cacheStrategy.set(`slug:${updatedArticle.slug}`, updatedArticle, {
        type: 'article',
        ttl: 600,
      }),
    ]);

    return updatedArticle;
  }

  async toggleVisible(id: string): Promise<Article> {
    const article = await this.findById(id);

    article.isVisible = !article.isVisible;
    // TypeORM 的 @UpdateDateColumn 装饰器会自动管理 updatedAt

    const updatedArticle = await this.articleRepository.save(article);

    // 更新缓存
    await this.clearArticleCache(id, article.slug);

    return updatedArticle;
  }

  async batchRemove(ids: string[]): Promise<void> {
    // 使用 TypeORM 的软删除
    await this.articleRepository.softDelete({ id: In(ids) });
    // TypeORM 的 @DeleteDateColumn 和 @UpdateDateColumn 装饰器会自动管理时间戳

    // 清除相关缓存
    for (const id of ids) {
      await this.clearArticleCache(id);
    }
  }

  async getFeatured(limit: number = 10): Promise<Article[]> {
    const cacheKey = `articles:featured:${limit}`;
    const cachedArticles = await this.cacheManager.get<Article[]>(cacheKey);

    if (cachedArticles) {
      return cachedArticles;
    }

    const articles = await this.articleRepository.find({
      where: {
        status: 'published',
        isFeatured: true,
        isVisible: true,
      },
      order: { publishedAt: 'DESC' },
      take: limit,
      relations: ['author', 'category', 'tags'],
    });

    await this.cacheManager.set(cacheKey, articles, 300000); // 5分钟缓存
    return articles;
  }

  async search(searchDto: {
    q: string;
    page?: number;
    limit?: number;
  }): Promise<{ articles: Article[]; total: number }> {
    const { q: keyword, page = 1, limit = 10 } = searchDto;

    const queryBuilder = this.articleRepository
      .createQueryBuilder('article')
      .where('article.status = :status', { status: 'published' })
      .andWhere('article.isVisible = :isVisible', { isVisible: true })
      .andWhere('article.deletedAt IS NULL')
      .andWhere(
        '(article.title LIKE :keyword OR article.content LIKE :keyword)',
        {
          keyword: `%${keyword}%`,
        },
      )
      .leftJoinAndSelect('article.author', 'author')
      .leftJoinAndSelect('article.category', 'category')
      .leftJoinAndSelect('article.tags', 'tags')
      .orderBy('article.publishedAt', 'DESC');

    const [articles, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { articles, total };
  }

  async getArchive(archiveDto: {
    year?: number;
    month?: number;
  }): Promise<{ year: number; month: number; count: number }[]> {
    const { year, month } = archiveDto;

    const queryBuilder = this.articleRepository
      .createQueryBuilder('article')
      .select('YEAR(article.publishedAt)', 'year')
      .addSelect('MONTH(article.publishedAt)', 'month')
      .addSelect('COUNT(article.id)', 'count')
      .where('article.status = :status', { status: 'published' })
      .andWhere('article.deletedAt IS NULL')
      .groupBy('year, month')
      .orderBy('year', 'DESC')
      .addOrderBy('month', 'DESC');

    if (year) {
      queryBuilder.andWhere('YEAR(article.publishedAt) = :year', { year });
    }

    if (month) {
      queryBuilder.andWhere('MONTH(article.publishedAt) = :month', { month });
    }

    const result = await queryBuilder.getRawMany();
    return result.map((item) => ({
      year: parseInt(item.year),
      month: parseInt(item.month),
      count: parseInt(item.count),
    }));
  }

  async getRelated(id: string, limit: number = 5): Promise<Article[]> {
    const article = await this.findById(id);

    // 简单实现：获取相同作者的其他文章
    const relatedArticles = await this.articleRepository.find({
      where: {
        authorId: article.authorId,
        status: 'published',
        isVisible: true,
        id: Not(id),
      },
      order: { publishedAt: 'DESC' },
      take: limit,
      relations: ['author', 'category', 'tags'],
    });

    return relatedArticles;
  }

  async share(id: string): Promise<void> {
    await this.articleRepository.increment({ id }, 'shareCount', 1);

    // 清除缓存
    await this.clearArticleCache(id);
  }

  // 用户端API专用方法
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
    return await this.dataSource.transaction(async (manager) => {
      const article = await manager.findOne(Article, {
        where: { id, authorId },
      });
      if (!article) {
        throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
      }

      const { slug, tagIds, ...updateData } = updateArticleDto;

      // 如果更新slug，检查新slug是否已被其他文章使用
      if (slug && slug !== article.slug) {
        const existingArticle = await manager.findOne(Article, {
          where: { slug, id: Not(id) },
        });
        if (existingArticle) {
          throw new ConflictException(ErrorCode.ARTICLE_SLUG_EXISTS);
        }
      }

      // 处理标签更新
      if (tagIds !== undefined) {
        if (tagIds.length > 0) {
          const tags = await manager.getRepository(Tag).find({
            where: { id: In(tagIds) },
          });
          article.tags = tags;
        } else {
          article.tags = [];
        }
      }

      try {
        Object.assign(article, updateData, slug ? { slug } : {});
        const savedArticle = await manager.save(article);

        await this.clearArticleCache(id, article.slug);
        // 使用统一的缓存策略缓存文章
        await Promise.all([
          this.cacheStrategy.set(savedArticle.id, savedArticle, {
            type: 'article',
            ttl: 600,
          }),
          this.cacheStrategy.set(`slug:${savedArticle.slug}`, savedArticle, {
            type: 'article',
            ttl: 600,
          }),
        ]);

        return savedArticle;
      } catch (error: unknown) {
        // 处理数据库唯一约束错误
        const dbError = error as DatabaseError;
        if (
          (dbError &&
            typeof dbError === 'object' &&
            'code' in dbError &&
            dbError.code === 'ER_DUP_ENTRY') ||
          (dbError &&
            typeof dbError === 'object' &&
            'errno' in dbError &&
            dbError.errno === 1062)
        ) {
          throw new ConflictException(ErrorCode.ARTICLE_SLUG_EXISTS);
        }
        throw error;
      }
    });
  }

  async publishByAuthor(
    id: string,
    authorId: string,
    publishDto?: { publishedAt?: Date },
  ): Promise<Article> {
    const article = await this.findByIdAndAuthor(id, authorId);

    article.status = 'published';
    article.publishedAt = publishDto?.publishedAt
      ? publishDto.publishedAt
      : new Date();

    const publishedArticle = await this.articleRepository.save(article);

    await this.clearArticleCache(id, article.slug);

    return publishedArticle;
  }

  async removeByAuthor(id: string, authorId: string): Promise<void> {
    const article = await this.findByIdAndAuthor(id, authorId);

    // 使用 TypeORM 的软删除
    await this.articleRepository.softDelete({ id });
    // TypeORM 的 @DeleteDateColumn 和 @UpdateDateColumn 装饰器会自动管理时间戳
    await this.clearArticleCache(id, article.slug);
  }

  // 已移除cacheArticle方法，使用统一的缓存策略

  private async clearArticleCache(id: string, slug?: string): Promise<void> {
    try {
      // 清除特定文章的缓存
      const specificCachePromises = [
        this.cacheStrategy.del(id, { type: 'article' }),
      ];

      if (slug) {
        specificCachePromises.push(
          this.cacheStrategy.del(`slug:${slug}`, { type: 'article' }),
        );
      }

      // 清除聚合数据缓存（这些缓存在文章变更时需要失效）
      const aggregateCacheKeys = [
        'popular:10',
        'recent:10',
        'featured:10',
        'statistics',
      ];

      const aggregateCachePromises = aggregateCacheKeys.map((key) =>
        this.cacheStrategy
          .del(key, { type: 'article' })
          .catch((err) =>
            console.warn(`Failed to delete aggregate cache ${key}:`, err),
          ),
      );

      // 清除按模式匹配的缓存（如搜索结果、归档数据等）
      const patterns = [
        'article:search:*',
        'article:archive:*',
        'article:related:*',
      ];

      const patternPromises = patterns.map((pattern) =>
        this.cacheStrategy
          .clearCacheByPattern(pattern)
          .catch((err) =>
            console.warn(`Failed to clear cache pattern ${pattern}:`, err),
          ),
      );

      await Promise.all([
        ...specificCachePromises,
        ...aggregateCachePromises,
        ...patternPromises,
      ]);

      console.log(
        `Cleared article cache for ID: ${id}${slug ? `, slug: ${slug}` : ''}`,
      );
    } catch (error) {
      console.error('Failed to clear article cache:', error);
    }
  }

  private generateSlug(title: string): string {
    // 将标题转换为 slug 格式
    let slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff\s-]/g, '') // 保留中文、英文、数字、空格和连字符
      .replace(/\s+/g, '-') // 将空格替换为连字符
      .replace(/-+/g, '-') // 将多个连字符合并为一个
      .replace(/^-|-$/g, ''); // 移除开头和结尾的连字符

    // 如果 slug 为空，使用时间戳
    if (!slug) {
      slug = `article-${Date.now()}`;
    }

    return slug;
  }
}
