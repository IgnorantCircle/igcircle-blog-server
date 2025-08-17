import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from '@/entities/article.entity';
import { ArticleStatus } from '@/dto/article.dto';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';
import { BlogCacheService } from '@/common/cache/blog-cache.service';
import { TagService } from '../tag.service';
import { CategoryService } from '../category.service';
import {
  NotFoundException,
  ConflictException,
} from '@/common/exceptions/business.exception';
import { ErrorCode } from '@/common/constants/error-codes';

@Injectable()
export class ArticleStatusService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    private readonly logger: StructuredLoggerService,
    private readonly blogCacheService: BlogCacheService,
    @Inject(TagService)
    private readonly tagService: TagService,
    @Inject(CategoryService)
    private readonly categoryService: CategoryService,
  ) {
    this.logger.setContext({ module: 'ArticleStatusService' });
  }

  /**
   * 发布文章
   */
  async publish(
    id: string,
    publishDto?: { publishedAt?: Date },
  ): Promise<Article> {
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ['tags'],
    });
    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    if (article.status === 'published') {
      throw new ConflictException(
        ErrorCode.ARTICLE_INVALID_STATUS,
        '文章已经发布',
      );
    }

    // 使用update方法而不是save方法，避免意外覆盖其他字段
    await this.articleRepository.update(id, {
      status: 'published',
      publishedAt: publishDto?.publishedAt || new Date(),
      updatedAt: new Date(),
    });

    // 重新获取更新后的文章
    const updatedArticle = await this.articleRepository.findOne({
      where: { id },
      relations: ['tags'],
    });

    if (!updatedArticle) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    // 更新标签和分类的文章数量
    const tagIds = article.tags?.map((tag) => tag.id) || [];
    setImmediate(() => {
      void (async () => {
        // 更新标签文章数量
        if (tagIds.length > 0) {
          for (const tagId of tagIds) {
            try {
              await this.tagService.updateArticleCount(tagId);
            } catch (error) {
              this.logger.error(
                `发布文章后更新标签文章数量失败: tagId=${tagId}, error=${(error as Error).message || error}`,
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
              `发布文章后更新分类文章数量失败: categoryId=${article.categoryId}, error=${(error as Error).message || error}`,
            );
          }
        }
      })();
    });

    // 清除相关缓存 - 使用优化后的发布操作类型
    await this.blogCacheService.clearArticleCache(article.slug, 'publish');

    this.logger.log('文章发布成功', {
      metadata: { articleId: id, title: article.title },
    });

    return updatedArticle;
  }

  /**
   * 取消发布文章
   */
  async unpublish(id: string): Promise<Article> {
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ['tags'],
    });
    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    if (article.status !== 'published') {
      throw new ConflictException(
        ErrorCode.ARTICLE_INVALID_STATUS,
        '文章未发布',
      );
    }
    await this.articleRepository.update(id, {
      status: 'draft',
      publishedAt: null,
      updatedAt: new Date(),
    });

    // 重新获取更新后的文章
    const updatedArticle = await this.articleRepository.findOne({
      where: { id },
      relations: ['tags'],
    });

    if (!updatedArticle) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    // 更新标签和分类的文章数量
    const tagIds = article.tags?.map((tag) => tag.id) || [];
    setImmediate(() => {
      void (async () => {
        // 更新标签文章数量
        if (tagIds.length > 0) {
          for (const tagId of tagIds) {
            try {
              await this.tagService.updateArticleCount(tagId);
            } catch (error) {
              this.logger.error(
                `取消发布文章后更新标签文章数量失败: tagId=${tagId}, error=${(error as Error).message || error}`,
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
              `取消发布文章后更新分类文章数量失败: categoryId=${article.categoryId}, error=${(error as Error).message || error}`,
            );
          }
        }
      })();
    });

    // 清除相关缓存 - 取消发布操作
    await this.blogCacheService.clearArticleCache(article.slug, 'archive');

    this.logger.log('文章取消发布成功', {
      metadata: { articleId: id, title: article.title },
    });

    return updatedArticle;
  }

  /**
   * 归档文章
   */
  async archive(id: string): Promise<Article> {
    const article = await this.articleRepository.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    if (article.status === 'archived') {
      throw new ConflictException(
        ErrorCode.ARTICLE_INVALID_STATUS,
        '文章已经归档',
      );
    }

    await this.articleRepository.update(id, {
      status: 'archived',
      updatedAt: new Date(),
    });

    // 重新获取更新后的文章
    const updatedArticle = await this.articleRepository.findOne({
      where: { id },
      relations: ['tags'],
    });

    if (!updatedArticle) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    // 清除相关缓存 - 归档操作
    await this.blogCacheService.clearArticleCache(article.slug, 'archive');

    this.logger.log('文章归档成功', {
      metadata: { articleId: id, title: article.title },
    });

    return updatedArticle;
  }

  /**
   * 恢复归档文章
   */
  async unarchive(id: string): Promise<Article> {
    const article = await this.articleRepository.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    if (article.status !== 'archived') {
      throw new ConflictException(
        ErrorCode.ARTICLE_INVALID_STATUS,
        '文章未归档',
      );
    }

    // 使用update方法而不是save方法，避免意外覆盖其他字段
    await this.articleRepository.update(id, {
      status: 'draft',
      updatedAt: new Date(),
    });

    // 重新获取更新后的文章
    const updatedArticle = await this.articleRepository.findOne({
      where: { id },
      relations: ['tags'],
    });

    if (!updatedArticle) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    // 清除相关缓存
    await this.blogCacheService.clearArticleCache(article.slug, 'archive');

    this.logger.log('文章恢复成功', {
      metadata: { articleId: id, title: article.title },
    });

    return updatedArticle;
  }

  /**
   * 设置文章为精选
   */
  async setFeatured(id: string, featured: boolean = true): Promise<Article> {
    const article = await this.articleRepository.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    await this.articleRepository.update(id, {
      isFeatured: featured,
      updatedAt: new Date(),
    });

    // 重新获取更新后的文章
    const updatedArticle = await this.articleRepository.findOne({
      where: { id },
      relations: ['tags'],
    });

    if (!updatedArticle) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    // 清除相关缓存 - 精选状态变更
    await this.blogCacheService.clearArticleCache(article.slug, 'feature');

    this.logger.log(`文章${featured ? '设置' : '取消'}精选成功`, {
      metadata: { articleId: id, title: article.title, featured },
    });

    return updatedArticle;
  }

  /**
   * 设置文章为置顶
   */
  async setTop(id: string, top: boolean = true): Promise<Article> {
    const article = await this.articleRepository.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    await this.articleRepository.update(id, {
      isTop: top,
      updatedAt: new Date(),
    });

    // 重新获取更新后的文章
    const updatedArticle = await this.articleRepository.findOne({
      where: { id },
      relations: ['tags'],
    });

    if (!updatedArticle) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    // 清除相关缓存 - 置顶状态变更
    await this.blogCacheService.clearArticleCache(article.slug, 'top');

    this.logger.log(`文章${top ? '设置' : '取消'}置顶成功`, {
      metadata: { articleId: id, title: article.title, top },
    });

    return updatedArticle;
  }

  /**
   * 切换文章可见性
   */
  async toggleVisibility(id: string): Promise<Article> {
    const article = await this.articleRepository.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    const newVisibility = !article.isVisible;
    article.isVisible = newVisibility;
    article.updatedAt = new Date();

    await this.articleRepository.update(id, {
      isVisible: newVisibility,
      updatedAt: new Date(),
    });

    // 重新获取更新后的文章
    const updatedArticle = await this.articleRepository.findOne({
      where: { id },
      relations: ['tags'],
    });

    if (!updatedArticle) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    // 清除文章相关缓存
    await this.blogCacheService.clearArticleCache(article.slug);

    this.logger.log(`文章可见性切换成功`, {
      metadata: {
        articleId: id,
        title: article.title,
        isVisible: newVisibility,
      },
    });

    return updatedArticle;
  }

  /**
   * 批量发布文章
   */
  async batchPublish(ids: string[]): Promise<void> {
    const articles = await this.articleRepository.findByIds(ids);
    const publishableArticles = articles.filter(
      (article) => article.status === 'draft',
    );

    if (publishableArticles.length === 0) {
      throw new ConflictException(
        ErrorCode.ARTICLE_INVALID_STATUS,
        '没有可发布的文章',
      );
    }

    const now = new Date();
    await this.articleRepository.update(
      publishableArticles.map((article) => article.id),
      {
        status: ArticleStatus.PUBLISHED,
        publishedAt: now,
        updatedAt: now,
      },
    );

    this.logger.log('批量发布文章成功', {
      metadata: {
        count: publishableArticles.length,
        articleIds: publishableArticles.map((a) => a.id),
      },
    });
  }

  /**
   * 批量归档文章
   */
  async batchArchive(ids: string[]): Promise<void> {
    const articles = await this.articleRepository.findByIds(ids);
    const archivableArticles = articles.filter(
      (article) => article.status !== 'archived',
    );

    if (archivableArticles.length === 0) {
      throw new ConflictException(
        ErrorCode.ARTICLE_INVALID_STATUS,
        '没有可归档的文章',
      );
    }

    await this.articleRepository.update(
      archivableArticles.map((article) => article.id),
      {
        status: 'archived',
        updatedAt: new Date(),
      },
    );

    this.logger.log('批量归档文章成功', {
      metadata: {
        count: archivableArticles.length,
        articleIds: archivableArticles.map((a) => a.id),
      },
    });
  }

  /**
   * 获取不同状态的文章数量
   */
  async getStatusCounts(): Promise<{
    draft: number;
    published: number;
    archived: number;
  }> {
    const [draft, published, archived] = await Promise.all([
      this.articleRepository.count({ where: { status: 'draft' } }),
      this.articleRepository.count({ where: { status: 'published' } }),
      this.articleRepository.count({ where: { status: 'archived' } }),
    ]);

    return { draft, published, archived };
  }
}
