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
  BatchUpdateArticleDto,
  BatchExportArticleDto,
  BatchPublishArticleDto,
  ArticleStatus,
} from '@/dto/article.dto';
import { BaseService } from '@/common/base/base.service';
import { SlugUtil } from '@/common/utils/slug.util';
import { ArticleStatisticsService } from './article-statistics.service';
import {
  ArticleQueryService,
  ArticleQueryOptions,
} from './article-query.service';
import { ArticleStatusService } from './article-status.service';

import { ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';
import { BlogCacheService } from '@/common/cache/blog-cache.service';

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
    @Inject(BlogCacheService)
    private readonly blogCacheService: BlogCacheService,

    @Inject(ConfigService) configService: ConfigService,
    @Inject(StructuredLoggerService) logger: StructuredLoggerService,
  ) {
    super(articleRepository, 'article', configService, logger);
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

        return savedArticle;
      });
    } else {
      const entityData = createDataOrDto as Partial<Article>;
      const article = this.repository.create(entityData);
      const savedArticle = await this.repository.save(article);

      return savedArticle;
    }
  }

  // 根据ID查找文章
  async findById(id: string): Promise<Article> {
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ['author', 'tags', 'category'],
    });

    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    return article;
  }

  async findBySlug(slug: string): Promise<Article> {
    const article = await this.articleRepository.findOne({
      where: { slug },
      relations: ['author', 'tags', 'category'],
    });

    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

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
    const article = await this.findById(id);

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
    await this.findById(id);
    await this.articleRepository.softDelete(id);
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
  }

  async batchPublish(ids: string[]): Promise<void> {
    return this.articleStatusService.batchPublish(ids);
  }

  async batchArchive(ids: string[]): Promise<void> {
    return this.articleStatusService.batchArchive(ids);
  }

  async batchUpdate(batchUpdateDto: BatchUpdateArticleDto): Promise<void> {
    const { ids, ...updateData } = batchUpdateDto;

    // 验证文章是否存在
    const articles = await this.articleRepository.find({
      where: { id: In(ids) },
    });
    if (articles.length !== ids.length) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    return this.dataSource.transaction(async (manager) => {
      const updateFields: Partial<Article> = {};

      // 处理基本字段更新
      if (updateData.status !== undefined) {
        updateFields.status = updateData.status;
        if (updateData.status === ArticleStatus.PUBLISHED) {
          updateFields.publishedAt = new Date();
        }
      }
      if (updateData.isFeatured !== undefined) {
        updateFields.isFeatured = updateData.isFeatured;
      }
      if (updateData.isTop !== undefined) {
        updateFields.isTop = updateData.isTop;
      }
      if (updateData.isVisible !== undefined) {
        updateFields.isVisible = updateData.isVisible;
      }
      if (updateData.categoryId !== undefined) {
        updateFields.categoryId = updateData.categoryId;
      }

      updateFields.updatedAt = new Date();

      // 批量更新基本字段
      if (Object.keys(updateFields).length > 0) {
        await manager.update(Article, ids, updateFields);
      }

      // 处理标签关联更新
      if (updateData.tagIds !== undefined) {
        for (const id of ids) {
          const article = await manager.findOne(Article, {
            where: { id },
            relations: ['tags'],
          });
          if (article) {
            if (updateData.tagIds.length > 0) {
              const tags = await manager.getRepository(Tag).find({
                where: { id: In(updateData.tagIds) },
              });
              article.tags = tags;
            } else {
              article.tags = [];
            }
            await manager.save(article);
          }
        }
      }
    });
  }

  async batchPublishWithDate(
    batchPublishDto: BatchPublishArticleDto,
  ): Promise<void> {
    const { ids, publishedAt } = batchPublishDto;
    const publishDate = publishedAt ? new Date(publishedAt) : new Date();

    const articles = await this.articleRepository.find({
      where: { id: In(ids) },
    });
    const publishableArticles = articles.filter(
      (article) => article.status === 'draft',
    );

    if (publishableArticles.length === 0) {
      throw new ConflictException(
        ErrorCode.ARTICLE_INVALID_STATUS,
        '没有可发布的文章',
      );
    }

    await this.articleRepository.update(
      publishableArticles.map((article) => article.id),
      {
        status: 'published',
        publishedAt: publishDate,
        updatedAt: new Date(),
      },
    );
  }

  async batchExport(exportDto: BatchExportArticleDto): Promise<any> {
    const {
      ids,
      format = 'json',
      status,
      categoryId,
      tagIds,
      includeContent = true,
      includeTags = true,
      includeCategory = true,
    } = exportDto;

    const queryBuilder = this.articleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author')
      .select([
        'article.id',
        'article.title',
        'article.summary',
        'article.slug',
        'article.status',
        'article.coverImage',
        'article.readingTime',
        'article.viewCount',
        'article.likeCount',
        'article.shareCount',
        'article.isFeatured',
        'article.isTop',
        'article.isVisible',
        'article.createdAt',
        'article.updatedAt',
        'article.publishedAt',
        'author.id',
        'author.username',
        'author.email',
      ]);

    if (includeContent) {
      queryBuilder.addSelect('article.content');
    }

    // 添加分类信息
    if (includeCategory) {
      queryBuilder
        .leftJoinAndSelect('article.category', 'category')
        .addSelect(['category.id', 'category.name', 'category.slug']);
    }

    // 添加标签信息
    if (includeTags) {
      queryBuilder
        .leftJoinAndSelect('article.tags', 'tags')
        .addSelect(['tags.id', 'tags.name', 'tags.slug']);
    }

    // 应用过滤条件
    if (ids && ids.length > 0) {
      queryBuilder.andWhere('article.id IN (:...ids)', { ids });
    }
    if (status) {
      queryBuilder.andWhere('article.status = :status', { status });
    }
    if (categoryId) {
      queryBuilder.andWhere('article.categoryId = :categoryId', { categoryId });
    }
    if (tagIds && tagIds.length > 0) {
      queryBuilder.andWhere('tags.id IN (:...tagIds)', { tagIds });
    }

    const articles = await queryBuilder.getMany();

    // 根据格式返回数据
    switch (format) {
      case 'csv':
        return this.convertToCSV(articles);
      case 'markdown':
        return this.convertToMarkdown(articles);
      case 'json':
      default:
        return articles;
    }
  }

  private convertToCSV(articles: Article[]): string {
    if (articles.length === 0) return '';

    const headers = [
      'ID',
      '标题',
      '摘要',
      'Slug',
      '状态',
      '作者',
      '分类',
      '标签',
      '阅读时间',
      '浏览次数',
      '点赞数',
      '是否精选',
      '是否置顶',
      '创建时间',
      '发布时间',
    ];

    interface ArticleWithRelations {
      id: string;
      title: string;
      summary?: string;
      slug: string;
      status: string;
      author?: { username?: string };
      category?: { name?: string };
      tags?: { name?: string }[];
      readingTime?: number;
      viewCount?: number;
      likeCount?: number;
      isFeatured?: boolean;
      isTop?: boolean;
      createdAt?: Date;
      publishedAt?: Date;
    }

    const rows = (articles as ArticleWithRelations[]).map((article) => [
      article.id,
      `"${article.title.replace(/"/g, '""')}"`,
      `"${(article.summary || '').replace(/"/g, '""')}"`,
      article.slug,
      article.status,
      article.author?.username || '',
      article.category?.name || '',
      article.tags?.map((tag) => tag.name).join(';') || '',
      article.readingTime || 0,
      article.viewCount || 0,
      article.likeCount || 0,
      article.isFeatured ? '是' : '否',
      article.isTop ? '是' : '否',
      article.createdAt?.toISOString() || '',
      article.publishedAt?.toISOString() || '',
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  private convertToMarkdown(articles: Article[]): string {
    interface ArticleWithRelations {
      id: string;
      title: string;
      summary?: string;
      status: string;
      author?: { username?: string };
      category?: { name?: string };
      tags?: { name?: string }[];
      content?: string;
      createdAt?: Date;
      publishedAt?: Date;
    }

    return (articles as ArticleWithRelations[])
      .map((article) => {
        let markdown = `# ${article.title}\n\n`;

        if (article.summary) {
          markdown += `**摘要**: ${article.summary}\n\n`;
        }

        markdown += `**状态**: ${article.status}\n`;
        markdown += `**作者**: ${article.author?.username || '未知'}\n`;

        if (article.category) {
          markdown += `**分类**: ${article.category.name}\n`;
        }

        if (article.tags && article.tags.length > 0) {
          markdown += `**标签**: ${article.tags.map((tag) => tag.name).join(', ')}\n`;
        }

        markdown += `**创建时间**: ${article.createdAt?.toISOString() || ''}\n`;

        if (article.publishedAt) {
          markdown += `**发布时间**: ${article.publishedAt.toISOString()}\n`;
        }

        if (article.content) {
          markdown += `\n---\n\n${article.content}`;
        }

        return markdown;
      })
      .join('\n\n---\n\n');
  }

  async getFeatured(limit: number = 10): Promise<Article[]> {
    const result = await this.articleQueryService.getFeaturedArticles({
      limit,
      status: ArticleStatus.PUBLISHED,
    });
    // 过滤出可见的文章
    return result.items.filter((article) => article.isVisible);
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
