import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from '@/entities/article.entity';
import { ArticleStatus } from '@/dto/article.dto';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@/common/exceptions/business.exception';
import { ErrorCode } from '@/common/constants/error-codes';

@Injectable()
export class ArticleStatusService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    private readonly logger: StructuredLoggerService,
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
    const article = await this.articleRepository.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    if (article.status === 'published') {
      throw new ConflictException(
        ErrorCode.ARTICLE_INVALID_STATUS,
        '文章已经发布',
      );
    }

    article.status = 'published';
    article.publishedAt = publishDto?.publishedAt || new Date();
    article.updatedAt = new Date();

    const updatedArticle = await this.articleRepository.save(article);

    this.logger.log('文章发布成功', {
      metadata: { articleId: id, title: article.title },
    });

    return updatedArticle;
  }

  /**
   * 取消发布文章
   */
  async unpublish(id: string): Promise<Article> {
    const article = await this.articleRepository.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    if (article.status !== 'published') {
      throw new ConflictException(
        ErrorCode.ARTICLE_INVALID_STATUS,
        '文章未发布',
      );
    }

    article.status = 'draft';
    article.publishedAt = null;
    article.updatedAt = new Date();

    const updatedArticle = await this.articleRepository.save(article);

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

    article.status = 'archived';
    article.updatedAt = new Date();

    const updatedArticle = await this.articleRepository.save(article);

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

    article.status = 'draft';
    article.updatedAt = new Date();

    const updatedArticle = await this.articleRepository.save(article);

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

    article.isFeatured = featured;
    article.updatedAt = new Date();

    const updatedArticle = await this.articleRepository.save(article);

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

    article.isTop = top;
    article.updatedAt = new Date();

    const updatedArticle = await this.articleRepository.save(article);

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

    article.isVisible = !article.isVisible;
    article.updatedAt = new Date();

    const updatedArticle = await this.articleRepository.save(article);

    this.logger.log(`文章可见性切换成功`, {
      metadata: {
        articleId: id,
        title: article.title,
        isVisible: article.isVisible,
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
   * 作者发布文章
   */
  async publishByAuthor(
    id: string,
    authorId: string,
    publishDto?: { publishedAt?: Date },
  ): Promise<Article> {
    const article = await this.articleRepository.findOne({
      where: { id, authorId },
    });
    if (!article) {
      throw new ForbiddenException(
        ErrorCode.ARTICLE_ACCESS_DENIED,
        '文章不存在或无权限',
      );
    }

    if (article.status === 'published') {
      throw new ConflictException(
        ErrorCode.ARTICLE_INVALID_STATUS,
        '文章已经发布',
      );
    }

    article.status = 'published';
    article.publishedAt = publishDto?.publishedAt || new Date();
    article.updatedAt = new Date();

    const updatedArticle = await this.articleRepository.save(article);

    this.logger.log('作者发布文章成功', {
      metadata: { articleId: id, authorId, title: article.title },
    });

    return updatedArticle;
  }

  /**
   * 根据作者删除文章
   */
  async removeByAuthor(id: string, authorId: string): Promise<void> {
    const article = await this.articleRepository.findOne({
      where: { id, authorId },
    });

    if (!article) {
      throw new ForbiddenException(
        ErrorCode.ARTICLE_ACCESS_DENIED,
        '文章不存在或您没有权限',
      );
    }

    await this.articleRepository.delete(id);

    this.logger.log('作者删除文章成功', {
      metadata: { articleId: id, authorId, title: article.title },
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
