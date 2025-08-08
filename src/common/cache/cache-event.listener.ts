import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CacheStrategyService } from './cache-strategy.service';
import { StructuredLoggerService } from '../logger/structured-logger.service';

// 定义缓存事件类型
export interface CacheInvalidationEvent {
  type: 'article' | 'user' | 'category' | 'tag' | 'comment';
  action: 'create' | 'update' | 'delete' | 'publish' | 'unpublish';
  entityId: string;
  relatedIds?: string[];
  tags?: string[];
}

@Injectable()
export class CacheEventListener {
  constructor(
    private readonly cacheStrategy: CacheStrategyService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext({ module: 'CacheEventListener' });
  }

  /**
   * 处理文章相关的缓存失效
   */
  @OnEvent('cache.invalidate.article')
  async handleArticleCacheInvalidation(event: CacheInvalidationEvent) {
    try {
      const { action, entityId, relatedIds, tags } = event;

      // 清除文章相关的缓存
      const cachePromises: Promise<void>[] = [
        // 清除文章本身的缓存
        this.cacheStrategy.del(entityId, { type: 'article' }),
      ];

      // 根据操作类型清除不同的缓存
      switch (action) {
        case 'create':
        case 'publish':
          // 新文章发布时，清除列表缓存
          cachePromises.push(
            this.cacheStrategy.clearByTags(['article', 'content']),
          );
          break;

        case 'update':
          // 文章更新时，清除相关缓存
          if (relatedIds) {
            cachePromises.push(
              ...relatedIds.map((id) =>
                this.cacheStrategy.del(id, { type: 'article' }),
              ),
            );
          }
          break;

        case 'delete':
          // 文章删除时，清除所有相关缓存
          cachePromises.push(
            this.cacheStrategy.clearByTags(['article', 'content']),
          );
          break;
      }

      // 如果指定了标签，按标签清除
      if (tags && tags.length > 0) {
        cachePromises.push(this.cacheStrategy.clearByTags(tags));
      }

      await Promise.all(cachePromises);

      this.logger.log(
        `Article cache invalidation completed: action=${action}, entityId=${entityId}, relatedIds=${JSON.stringify(relatedIds)}, tags=${JSON.stringify(tags)}`,
      );
    } catch (error) {
      this.logger.error(
        'Article cache invalidation failed',
        `Error: ${(error as Error).message}, Event: ${JSON.stringify(event)}`,
      );
    }
  }

  /**
   * 处理用户相关的缓存失效
   */
  @OnEvent('cache.invalidate.user')
  async handleUserCacheInvalidation(event: CacheInvalidationEvent) {
    try {
      const { action, entityId, tags } = event;

      const cachePromises: Promise<void>[] = [
        this.cacheStrategy.del(entityId, { type: 'user' }),
      ];

      // 用户信息变更时，可能需要清除相关的文章缓存
      if (action === 'update') {
        cachePromises.push(this.cacheStrategy.clearByTags(['user', 'auth']));
      }

      if (tags && tags.length > 0) {
        cachePromises.push(this.cacheStrategy.clearByTags(tags));
      }

      await Promise.all(cachePromises);

      this.logger.log(
        `User cache invalidation completed: action=${action}, entityId=${entityId}, tags=${JSON.stringify(tags)}`,
      );
    } catch (error) {
      this.logger.error(
        'User cache invalidation failed',
        `Error: ${(error as Error).message}, Event: ${JSON.stringify(event)}`,
      );
    }
  }

  /**
   * 处理分类相关的缓存失效
   */
  @OnEvent('cache.invalidate.category')
  async handleCategoryCacheInvalidation(event: CacheInvalidationEvent) {
    try {
      const { action, entityId, tags } = event;

      const cachePromises: Promise<void>[] = [
        this.cacheStrategy.del(entityId, { type: 'category' }),
        // 分类变更会影响文章列表
        this.cacheStrategy.clearByTags(['category', 'content']),
      ];

      if (tags && tags.length > 0) {
        cachePromises.push(this.cacheStrategy.clearByTags(tags));
      }

      await Promise.all(cachePromises);

      this.logger.log(
        `Category cache invalidation completed: action=${action}, entityId=${entityId}, tags=${JSON.stringify(tags)}`,
      );
    } catch (error) {
      this.logger.error(
        'Category cache invalidation failed',
        `Error: ${(error as Error).message}, Event: ${JSON.stringify(event)}`,
      );
    }
  }

  /**
   * 处理标签相关的缓存失效
   */
  @OnEvent('cache.invalidate.tag')
  async handleTagCacheInvalidation(event: CacheInvalidationEvent) {
    try {
      const { action, entityId, tags } = event;

      const cachePromises: Promise<void>[] = [
        this.cacheStrategy.del(entityId, { type: 'tag' }),
        // 标签变更会影响文章和标签云
        this.cacheStrategy.clearByTags(['tag', 'content']),
      ];

      if (tags && tags.length > 0) {
        cachePromises.push(this.cacheStrategy.clearByTags(tags));
      }

      await Promise.all(cachePromises);

      this.logger.log(
        `Tag cache invalidation completed: action=${action}, entityId=${entityId}, tags=${JSON.stringify(tags)}`,
      );
    } catch (error) {
      this.logger.error(
        'Tag cache invalidation failed',
        `Error: ${(error as Error).message}, Event: ${JSON.stringify(event)}`,
      );
    }
  }

  /**
   * 处理评论相关的缓存失效
   */
  @OnEvent('cache.invalidate.comment')
  async handleCommentCacheInvalidation(event: CacheInvalidationEvent) {
    try {
      const { action, entityId, relatedIds, tags } = event;

      const cachePromises: Promise<void>[] = [
        this.cacheStrategy.del(entityId, { type: 'comment' }),
      ];

      // 评论变更时，清除相关文章的缓存
      if (relatedIds) {
        cachePromises.push(
          ...relatedIds.map((articleId) =>
            this.cacheStrategy.del(articleId, { type: 'article' }),
          ),
        );
      }

      // 清除评论相关的缓存
      cachePromises.push(
        this.cacheStrategy.clearByTags(['comment', 'content']),
      );

      if (tags && tags.length > 0) {
        cachePromises.push(this.cacheStrategy.clearByTags(tags));
      }

      await Promise.all(cachePromises);

      this.logger.log(
        `Comment cache invalidation completed: action=${action}, entityId=${entityId}, relatedIds=${JSON.stringify(relatedIds)}, tags=${JSON.stringify(tags)}`,
      );
    } catch (error) {
      this.logger.error(
        'Comment cache invalidation failed',
        `Error: ${(error as Error).message}, Event: ${JSON.stringify(event)}`,
      );
    }
  }

  /**
   * 批量处理缓存失效事件
   */
  @OnEvent('cache.invalidate.batch')
  async handleBatchCacheInvalidation(events: CacheInvalidationEvent[]) {
    try {
      const invalidationPromises = events.map((event) => {
        switch (event.type) {
          case 'article':
            return this.handleArticleCacheInvalidation(event);
          case 'user':
            return this.handleUserCacheInvalidation(event);
          case 'category':
            return this.handleCategoryCacheInvalidation(event);
          case 'tag':
            return this.handleTagCacheInvalidation(event);
          case 'comment':
            return this.handleCommentCacheInvalidation(event);
          default:
            return Promise.resolve();
        }
      });

      await Promise.all(invalidationPromises);

      this.logger.log(
        `Batch cache invalidation completed: eventCount=${events.length}, types=${JSON.stringify(events.map((e) => e.type))}`,
      );
    } catch (error) {
      this.logger.error(
        'Batch cache invalidation failed',
        `Error: ${(error as Error).message}, Event count: ${events.length}`,
      );
    }
  }
}
