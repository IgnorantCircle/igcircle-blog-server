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
import { TagService } from '../tag.service';
import { CategoryService } from '../category.service';
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
    @Inject(TagService)
    private readonly tagService: TagService,
    @Inject(CategoryService)
    private readonly categoryService: CategoryService,
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

        // 如果文章已发布，更新标签和分类的文章数量
        if (savedArticle.status === 'published') {
          setImmediate(() => {
            void (async () => {
              // 更新标签文章数量
              if (tagIds && tagIds.length > 0) {
                for (const tagId of tagIds) {
                  try {
                    await this.tagService.updateArticleCount(tagId);
                  } catch (error) {
                    this.logger.error(
                      `更新标签文章数量失败: tagId=${tagId}, error=${(error as Error).message || error}`,
                    );
                  }
                }
              }
              // 更新分类文章数量
              if (savedArticle.categoryId) {
                try {
                  await this.categoryService.updateArticleCount(
                    savedArticle.categoryId,
                  );
                } catch (error) {
                  this.logger.error(
                    `更新分类文章数量失败: categoryId=${savedArticle.categoryId}, error=${(error as Error).message || error}`,
                  );
                }
              }
            })();
          });
        }

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
    // 查询数据库获取文章
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ['author', 'tags', 'category'],
    });

    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    // 检查是否有该文章的slug缓存，如果没有则缓存
    const cached = await this.blogCacheService.getArticleDetailBySlug(
      article.slug,
    );
    if (!cached) {
      await this.blogCacheService.setArticleDetailBySlug(article.slug, article);
    }

    return article;
  }

  async findBySlug(slug: string): Promise<Article> {
    // 先检查slug缓存
    const cached = await this.blogCacheService.getArticleDetailBySlug(slug);
    if (cached) {
      return cached as Article;
    }

    // 缓存未命中，查询数据库
    const article = await this.articleRepository.findOne({
      where: { slug },
      relations: ['author', 'tags', 'category'],
    });

    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    // 缓存结果
    await this.blogCacheService.setArticleDetailBySlug(slug, article);
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
      isFeatured: query.isFeatured,
      isTop: query.isTop,
      keyword: query.keyword,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'DESC',
      includeTags: query.includeTags,
      includeCategory: query.includeCategory,
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

    if (updatedArticle.status === 'published') {
      updatedArticle.publishedAt = updatedArticle.publishedAt ?? new Date();
    }
    const savedArticle = await this.repository.save(updatedArticle);

    // 如果文章已发布，更新标签和分类的文章数量
    if (savedArticle.status === 'published') {
      setImmediate(() => {
        void (async () => {
          // 更新标签文章数量（如果是UpdateArticleDto类型且包含tagIds）
          if (
            isUpdateDto &&
            'tagIds' in updateDataOrDto &&
            updateDataOrDto.tagIds !== undefined
          ) {
            const tagIds = updateDataOrDto.tagIds;
            // 获取原文章的标签ID
            const originalTagIds = article.tags?.map((tag) => tag.id) || [];
            // 合并所有需要更新的标签ID（包括新的和原来的）
            const allTagIds = [
              ...new Set([...tagIds, ...originalTagIds]),
            ] as string[];

            if (allTagIds.length > 0) {
              for (const tagId of allTagIds) {
                try {
                  await this.tagService.updateArticleCount(tagId);
                } catch (error) {
                  this.logger.error(
                    `更新标签文章数量失败: tagId=${tagId}, error=${(error as Error).message || error}`,
                  );
                }
              }
            }
          }

          // 更新分类文章数量（如果分类发生变化或文章状态变化）
          const categoryIds = new Set<string>();
          if (savedArticle.categoryId) {
            categoryIds.add(savedArticle.categoryId);
          }
          if (
            article.categoryId &&
            article.categoryId !== savedArticle.categoryId
          ) {
            categoryIds.add(article.categoryId);
          }

          for (const categoryId of categoryIds) {
            try {
              await this.categoryService.updateArticleCount(categoryId);
            } catch (error) {
              this.logger.error(
                `更新分类文章数量失败: categoryId=${categoryId}, error=${(error as Error).message || error}`,
              );
            }
          }
        })();
      });
    }

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

  async like(id: string): Promise<void> {
    return this.articleStatisticsService.like(id);
  }

  async remove(id: string): Promise<void> {
    const article = await this.findById(id);

    // 获取文章关联的标签ID
    const tagIds = article.tags?.map((tag) => tag.id) || [];

    await this.articleRepository.softDelete(id);

    // 如果文章已发布，更新标签和分类的文章数量
    if (article.status === 'published') {
      setImmediate(() => {
        void (async () => {
          // 更新标签文章数量
          if (tagIds.length > 0) {
            for (const tagId of tagIds) {
              try {
                await this.tagService.updateArticleCount(tagId);
              } catch (error) {
                this.logger.error(
                  `删除文章后更新标签文章数量失败: tagId=${tagId}, error=${(error as Error).message || error}`,
                );
              }
            }
          }
          // 更新分类文章数量
          if (article.categoryId) {
            try {
              await this.categoryService.updateArticleCount(article.categoryId);
            } catch (error) {
              this.logger.error(
                `删除文章后更新分类文章数量失败: categoryId=${article.categoryId}, error=${(error as Error).message || error}`,
              );
            }
          }
        })();
      });
    }
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
        status: ArticleStatus.PUBLISHED,
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
        // 如果是多篇文章，返回每篇文章的独立markdown内容
        if (articles.length > 1) {
          return this.convertToMarkdownFiles(articles);
        }
        // 单篇文章仍然返回字符串
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

  private convertToMarkdownFiles(articles: Article[]): { files: { filename: string; content: string }[] } {
    interface ArticleWithRelations {
      id: string;
      title: string;
      summary?: string;
      slug: string;
      status: string;
      author?: { username?: string };
      category?: { name?: string };
      tags?: { name?: string }[];
      content?: string;
      createdAt?: Date;
      publishedAt?: Date;
    }

    const files = (articles as ArticleWithRelations[]).map((article) => {
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

      // 使用slug作为文件名，如果没有slug则使用标题
      const filename = article.slug
        ? `${article.slug}.md`
        : `${article.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}.md`;
      
      return {
        filename,
        content: markdown,
      };
    });

    return { files };
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
