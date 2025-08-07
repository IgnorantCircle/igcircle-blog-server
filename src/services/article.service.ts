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

// 定义数据库错误接口
interface DatabaseError {
  code?: string;
  errno?: number;
}

@Injectable()
export class ArticleService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly dataSource: DataSource,
  ) {}

  async create(createArticleDto: CreateArticleDto): Promise<Article> {
    const { status = 'draft', slug, tagIds, ...articleData } = createArticleDto;

    // 使用事务确保数据一致性
    return await this.dataSource.transaction(async (manager) => {
      // 生成或验证 slug
      let finalSlug = slug;
      if (!finalSlug) {
        // 生成基础slug，不添加后缀
        finalSlug = this.generateSlug(articleData.title);
      }

      // 检查slug是否已存在，如果存在则拒绝创建
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

        // 只在有值时才设置时间戳字段，否则让数据库使用默认值
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

        // 缓存文章
        await this.cacheArticle(savedArticle);

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
  async findById(id: string): Promise<Article> {
    const cacheKey = `article:${id}`;
    const cachedArticle = await this.cacheManager.get<Article>(cacheKey);

    if (cachedArticle) {
      return cachedArticle;
    }

    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ['author', 'category', 'tags'],
    });

    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    await this.cacheArticle(article);

    return article;
  }

  async findBySlug(slug: string): Promise<Article> {
    const cacheKey = `article:slug:${slug}`;
    const cachedArticle = await this.cacheManager.get<Article>(cacheKey);

    if (cachedArticle) {
      return cachedArticle;
    }

    const article = await this.articleRepository.findOne({
      where: { slug },
      relations: ['author', 'category', 'tags'],
    });

    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    await this.cacheArticle(article);

    return article;
  }

  async findAll(
    query: ArticleQueryDto,
  ): Promise<{ articles: Article[]; total: number }> {
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
    return { articles, total };
  }

  async update(
    id: string,
    updateArticleDto: UpdateArticleDto,
  ): Promise<Article> {
    return await this.dataSource.transaction(async (manager) => {
      const article = await manager.findOne(Article, {
        where: { id },
        relations: ['tags'],
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

      try {
        Object.assign(article, updateData, slug ? { slug } : {}, {
          updatedAt: Date.now(),
        });

        // 处理标签关联
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

        const savedArticle = await manager.save(article);

        await this.clearArticleCache(id, article.slug);
        await this.cacheArticle(savedArticle);

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

  async publish(
    id: string,
    publishDto?: { publishedAt?: number },
  ): Promise<Article> {
    const article = await this.findById(id);

    article.status = 'published';
    article.publishedAt = publishDto?.publishedAt
      ? publishDto.publishedAt
      : Date.now();
    article.updatedAt = Date.now();

    const publishedArticle = await this.articleRepository.save(article);

    // 更新缓存
    await this.cacheArticle(publishedArticle);

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

  async remove(id: string): Promise<void> {
    const article = await this.findById(id);

    // 逻辑删除
    const now = Date.now();
    await this.articleRepository.update(
      { id },
      { deletedAt: now, updatedAt: now },
    );

    // 清除缓存
    await this.clearArticleCache(id, article.slug);
  }

  async getPopular(limit: number = 10): Promise<Article[]> {
    const cacheKey = `articles:popular:${limit}`;
    const cachedArticles = await this.cacheManager.get<Article[]>(cacheKey);

    if (cachedArticles) {
      return cachedArticles;
    }

    const articles = await this.articleRepository.find({
      where: { status: 'published', isVisible: true },
      order: { likeCount: 'DESC', viewCount: 'DESC' },
      take: limit,
      relations: ['author', 'category', 'tags'],
    });

    await this.cacheManager.set(cacheKey, articles, 3600); // 1小时缓存
    return articles;
  }

  // 获取最新文章
  async getRecent(limit: number = 10): Promise<Article[]> {
    const cacheKey = `articles:recent:${limit}`;
    const cachedArticles = await this.cacheManager.get<Article[]>(cacheKey);

    if (cachedArticles) {
      return cachedArticles;
    }

    const articles = await this.articleRepository.find({
      where: { status: 'published', isVisible: true },
      order: { publishedAt: 'DESC' },
      take: limit,
      relations: ['author', 'category', 'tags'],
    });

    await this.cacheManager.set(cacheKey, articles, 3600); // 1小时缓存
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

    // 更新缓存
    await this.cacheArticle(updatedArticle);

    return updatedArticle;
  }

  async archive(id: string): Promise<Article> {
    const article = await this.findById(id);

    article.status = 'archived';

    const archivedArticle = await this.articleRepository.save(article);

    // 更新缓存
    await this.cacheArticle(archivedArticle);

    return archivedArticle;
  }

  async toggleFeature(id: string): Promise<Article> {
    const article = await this.findById(id);

    article.isFeatured = !article.isFeatured;

    const updatedArticle = await this.articleRepository.save(article);

    // 更新缓存
    await this.cacheArticle(updatedArticle);

    return updatedArticle;
  }

  async toggleTop(id: string): Promise<Article> {
    const article = await this.findById(id);

    article.isTop = !article.isTop;

    const updatedArticle = await this.articleRepository.save(article);

    // 更新缓存
    await this.cacheArticle(updatedArticle);

    return updatedArticle;
  }

  async toggleVisible(id: string): Promise<Article> {
    const article = await this.findById(id);

    article.isVisible = !article.isVisible;
    article.updatedAt = Date.now();

    const updatedArticle = await this.articleRepository.save(article);

    // 更新缓存
    await this.clearArticleCache(id, article.slug);

    return updatedArticle;
  }

  async batchRemove(ids: string[]): Promise<void> {
    // 逻辑删除
    const now = Date.now();
    await this.articleRepository.update(
      { id: In(ids) },
      { deletedAt: now, updatedAt: now },
    );

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
      .select('YEAR(FROM_UNIXTIME(article.publishedAt / 1000))', 'year')
      .addSelect('MONTH(FROM_UNIXTIME(article.publishedAt / 1000))', 'month')
      .addSelect('COUNT(article.id)', 'count')
      .where('article.status = :status', { status: 'published' })
      .andWhere('article.deletedAt IS NULL')
      .groupBy('year, month')
      .orderBy('year', 'DESC')
      .addOrderBy('month', 'DESC');

    if (year) {
      queryBuilder.andWhere(
        'YEAR(FROM_UNIXTIME(article.publishedAt / 1000)) = :year',
        { year },
      );
    }

    if (month) {
      queryBuilder.andWhere(
        'MONTH(FROM_UNIXTIME(article.publishedAt / 1000)) = :month',
        { month },
      );
    }

    const result = await queryBuilder.getRawMany();
    return result as { year: number; month: number; count: number }[];
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

      const { slug, ...updateData } = updateArticleDto;

      // 如果更新slug，检查新slug是否已被其他文章使用
      if (slug && slug !== article.slug) {
        const existingArticle = await manager.findOne(Article, {
          where: { slug, id: Not(id) },
        });
        if (existingArticle) {
          throw new ConflictException(ErrorCode.ARTICLE_SLUG_EXISTS);
        }
      }

      try {
        Object.assign(article, updateData, slug ? { slug } : {});
        const savedArticle = await manager.save(article);

        await this.clearArticleCache(id, article.slug);
        await this.cacheArticle(savedArticle);

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
    publishDto?: { publishedAt?: number },
  ): Promise<Article> {
    const article = await this.findByIdAndAuthor(id, authorId);

    article.status = 'published';
    article.publishedAt = publishDto?.publishedAt
      ? publishDto.publishedAt
      : Date.now();

    const publishedArticle = await this.articleRepository.save(article);

    await this.clearArticleCache(id, article.slug);

    return publishedArticle;
  }

  async removeByAuthor(id: string, authorId: string): Promise<void> {
    const article = await this.findByIdAndAuthor(id, authorId);

    // 逻辑删除
    const now = Date.now();
    await this.articleRepository.update(
      { id },
      { deletedAt: now, updatedAt: now },
    );
    await this.clearArticleCache(id, article.slug);
  }

  private async cacheArticle(article: Article): Promise<void> {
    const ttl = 60 * 60; // 1小时

    await Promise.all([
      this.cacheManager.set(`article:${article.id}`, article, ttl),
      this.cacheManager.set(`article:slug:${article.slug}`, article, ttl),
    ]);
  }

  private async clearArticleCache(id: string, slug?: string): Promise<void> {
    const promises = [
      this.cacheManager.del(`article:${id}`),
      this.cacheManager.del('articles:popular:10'),
      this.cacheManager.del('articles:recent:10'),
    ];

    if (slug) {
      promises.push(this.cacheManager.del(`article:slug:${slug}`));
    }

    await Promise.all(promises);
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
