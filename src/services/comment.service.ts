import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, SelectQueryBuilder } from 'typeorm';
import { Comment } from '@/entities/comment.entity';
import { CommentLike } from '@/entities/comment-like.entity';
import { Article } from '@/entities/article.entity';
import {
  CreateCommentDto,
  UpdateCommentDto,
  AdminUpdateCommentDto,
  CommentQueryDto,
  CommentStatus,
} from '@/dto/comment.dto';
import { ArticleStatus } from '@/dto/article.dto';
import {
  NotFoundException,
  ForbiddenException,
} from '@/common/exceptions/business.exception';
import { ErrorCode } from '@/common/constants/error-codes';
import { BaseService } from '@/common/base/base.service';
import { CACHE_TYPES } from '@/common/cache/cache.config';
import { CacheService } from '@/common/cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';
import { PaginationUtil } from '@/common/utils/pagination.util';

@Injectable()
export class CommentService extends BaseService<Comment> {
  constructor(
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(CommentLike)
    private commentLikeRepository: Repository<CommentLike>,
    @InjectRepository(Article)
    private articleRepository: Repository<Article>,
    @Inject(CacheService) cacheService: CacheService,
    @Inject(ConfigService) configService: ConfigService,
    @Inject(StructuredLoggerService) logger: StructuredLoggerService,
  ) {
    super(commentRepository, 'comment', cacheService, configService, logger);
    this.logger.setContext({ module: 'CommentService' });
  }

  /**
   * 创建评论
   */
  async createComment(
    createCommentDto: CreateCommentDto,
    authorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Comment> {
    const { articleId, parentId, content } = createCommentDto;

    // 检查文章是否存在且允许评论
    const article = await this.articleRepository.findOne({
      where: { id: articleId, status: ArticleStatus.PUBLISHED },
    });

    if (!article) {
      throw new NotFoundException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    if (!article.allowComment) {
      throw new ForbiddenException(
        ErrorCode.COMMENT_DISABLED,
        '该文章不允许评论',
      );
    }

    // 如果是回复评论，检查父评论是否存在
    let parent: Comment | null = null;
    if (parentId) {
      parent = await this.commentRepository.findOne({
        where: { id: parentId, status: CommentStatus.ACTIVE },
      });

      if (!parent) {
        throw new NotFoundException(ErrorCode.COMMENT_PARENT_NOT_FOUND);
      }

      // 确保父评论属于同一篇文章
      if (parent.articleId !== articleId) {
        throw new ForbiddenException(
          ErrorCode.COMMENT_PARENT_NOT_FOUND,
          '父评论与文章不匹配',
        );
      }
    }

    // TypeORM 装饰器会自动管理 createdAt 和 updatedAt
    const comment = this.commentRepository.create({
      content,
      articleId,
      authorId,
      parentId: parentId || null,
      ipAddress,
      userAgent,
    });

    const savedComment = await this.commentRepository.save(comment);

    // 更新文章评论数
    await this.articleRepository.increment(
      { id: articleId },
      'commentCount',
      1,
    );

    // 如果是回复，更新父评论的回复数
    if (parentId) {
      await this.commentRepository.increment({ id: parentId }, 'replyCount', 1);
    }

    // 清除相关缓存
    await this.clearCommentCache(articleId);

    const result = await this.findById(savedComment.id);
    if (!result) {
      throw new NotFoundException(ErrorCode.COMMENT_NOT_FOUND);
    }
    return result;
  }

  // 移除重复的findById方法，使用BaseService的统一实现

  /**
   * 分页查询评论
   */
  async findAllComments(
    query: CommentQueryDto,
  ): Promise<{ comments: Comment[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      articleId,
      authorId,
      status,
      parentId,
      keyword,
      topLevelOnly,
    } = query;

    const queryBuilder = this.createQueryBuilder();

    // 基础过滤条件
    if (articleId) {
      queryBuilder.andWhere('comment.articleId = :articleId', { articleId });
    }

    if (authorId) {
      queryBuilder.andWhere('comment.authorId = :authorId', { authorId });
    }

    if (status) {
      queryBuilder.andWhere('comment.status = :status', { status });
    } else {
      // 默认只显示活跃状态的评论
      queryBuilder.andWhere('comment.status = :status', {
        status: CommentStatus.ACTIVE,
      });
    }

    if (parentId !== undefined) {
      if (parentId === null || topLevelOnly) {
        queryBuilder.andWhere('comment.parentId IS NULL');
      } else {
        queryBuilder.andWhere('comment.parentId = :parentId', { parentId });
      }
    }

    if (keyword) {
      queryBuilder.andWhere('comment.content LIKE :keyword', {
        keyword: `%${keyword}%`,
      });
    }

    // 排序
    queryBuilder.orderBy(`comment.${sortBy}`, sortOrder);

    // 分页
    const skip = PaginationUtil.calculateSkip(page, limit);
    queryBuilder.skip(skip).take(limit);

    const [comments, total] = await queryBuilder.getManyAndCount();

    return { comments, total };
  }

  /**
   * 获取文章的评论树结构
   */
  async getCommentTree(
    articleId: string,
    page = 1,
    limit = 10,
  ): Promise<{
    comments: Comment[];
    total: number;
  }> {
    // 获取顶级评论
    const queryDto = new CommentQueryDto();
    queryDto.articleId = articleId;
    queryDto.topLevelOnly = true;
    queryDto.page = page;
    queryDto.limit = limit;
    queryDto.sortBy = 'createdAt';
    queryDto.sortOrder = 'DESC';

    const topLevelComments = await this.findAllComments(queryDto);

    // 为每个顶级评论加载回复（限制数量）
    for (const comment of topLevelComments.comments) {
      if (comment.replyCount > 0) {
        const replies = await this.findAllComments({
          parentId: comment.id,
          page: 1,
          limit: 5, // 默认只显示5条回复
          sortBy: 'createdAt',
          sortOrder: 'ASC',
        } as CommentQueryDto);
        comment.replies = replies.comments;
      }
    }

    return topLevelComments;
  }

  /**
   * 更新评论（重写BaseService方法以处理权限检查和缓存清除）
   */
  async update(
    id: string,
    updateCommentDto: UpdateCommentDto | AdminUpdateCommentDto,
    userId?: string,
    isAdmin = false,
  ): Promise<Comment> {
    const comment = await super.findById(id);
    if (!comment) {
      throw new NotFoundException(ErrorCode.COMMENT_NOT_FOUND);
    }

    // 权限检查：只有评论作者或管理员可以编辑
    if (!isAdmin && comment.authorId !== userId) {
      throw new ForbiddenException(
        ErrorCode.COMMENT_ACCESS_DENIED,
        '无权限编辑此评论',
      );
    }

    // 普通用户只能编辑内容
    if (!isAdmin) {
      const { content } = updateCommentDto as UpdateCommentDto;
      if (content !== undefined) {
        comment.content = content;
      }
    } else {
      // 管理员可以编辑所有字段
      const adminDto = updateCommentDto as AdminUpdateCommentDto;
      Object.assign(comment, adminDto);
    }

    // 使用BaseService的update方法
    const updatedComment = await super.update(id, comment);

    // 清除缓存
    await this.clearCommentCache(comment.articleId, id);

    return updatedComment;
  }

  /**
   * 删除评论（重写BaseService方法以处理权限检查、评论计数和缓存清除）
   */
  async remove(id: string, userId?: string, isAdmin = false): Promise<void> {
    const comment = await super.findById(id);
    if (!comment) {
      throw new NotFoundException(ErrorCode.COMMENT_NOT_FOUND);
    }

    // 权限检查
    if (!isAdmin && comment.authorId !== userId) {
      throw new ForbiddenException(
        ErrorCode.COMMENT_ACCESS_DENIED,
        '无权限删除此评论',
      );
    }

    // 使用BaseService的softRemove方法
    await super.remove(id);

    // 更新文章评论数
    await this.articleRepository.decrement(
      { id: comment.articleId },
      'commentCount',
      1,
    );

    // 如果是回复，更新父评论的回复数
    if (comment.parentId) {
      await this.commentRepository.decrement(
        { id: comment.parentId },
        'replyCount',
        1,
      );
    }

    // 清除缓存
    await this.clearCommentCache(comment.articleId, id);
  }

  /**
   * 点赞/取消点赞评论
   */
  async toggleLike(
    commentId: string,
    userId: string,
  ): Promise<{
    liked: boolean;
    likeCount: number;
  }> {
    const comment = await this.findById(commentId);
    if (!comment) {
      throw new NotFoundException(ErrorCode.COMMENT_NOT_FOUND);
    }

    // 检查是否已点赞
    const existingLike = await this.commentLikeRepository.findOne({
      where: { commentId, userId },
    });

    let liked: boolean;
    let likeCountChange: number;

    if (existingLike) {
      // 取消点赞
      await this.commentLikeRepository.remove(existingLike);
      liked = false;
      likeCountChange = -1;
    } else {
      // 点赞
      // TypeORM 装饰器会自动管理 createdAt
      const like = this.commentLikeRepository.create({
        commentId,
        userId,
      });
      await this.commentLikeRepository.save(like);
      liked = true;
      likeCountChange = 1;
    }

    // 更新评论点赞数
    await this.commentRepository.increment(
      { id: commentId },
      'likeCount',
      likeCountChange,
    );

    const updatedComment = await this.findById(commentId);
    if (!updatedComment) {
      throw new NotFoundException(ErrorCode.COMMENT_NOT_FOUND);
    }

    // 清除缓存
    await this.clearCommentCache(comment.articleId, commentId);

    return {
      liked,
      likeCount: updatedComment.likeCount,
    };
  }

  /**
   * 检查用户是否点赞了评论
   */
  async checkUserLike(commentId: string, userId: string): Promise<boolean> {
    const like = await this.commentLikeRepository.findOne({
      where: { commentId, userId },
    });
    return !!like;
  }

  /**
   * 批量检查用户点赞状态
   */
  async checkUserLikes(
    commentIds: string[],
    userId: string,
  ): Promise<Record<string, boolean>> {
    const likes = await this.commentLikeRepository.find({
      where: { commentId: In(commentIds), userId },
    });

    const likeMap: Record<string, boolean> = {};
    commentIds.forEach((id) => {
      likeMap[id] = false;
    });

    likes.forEach((like) => {
      likeMap[like.commentId] = true;
    });

    return likeMap;
  }

  /**
   * 创建查询构建器
   */
  private createQueryBuilder(): SelectQueryBuilder<Comment> {
    return this.commentRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author')
      .leftJoinAndSelect('comment.parent', 'parent')
      .leftJoinAndSelect('parent.author', 'parentAuthor');
  }

  /**
   * 清除评论相关缓存
   */
  private async clearCommentCache(
    articleId: string,
    commentId?: string,
  ): Promise<void> {
    // 使用统一的缓存策略清除相关缓存
    const promises = [
      this.cacheService.del(`article:${articleId}`, {
        type: CACHE_TYPES.COMMENT,
      }),
      this.cacheService.del(`tree:${articleId}`, {
        type: CACHE_TYPES.COMMENT,
      }),
    ];

    if (commentId) {
      promises.push(
        this.cacheService.del(commentId, { type: CACHE_TYPES.COMMENT }),
      );
    }

    await Promise.all(promises);
  }
}
