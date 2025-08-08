import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CommentService } from '@/services/comment.service';
import { JwtAuthGuard } from '@/guards/auth.guard';
import { Public } from '@/decorators/public.decorator';
import { CurrentUser } from '@/decorators/user.decorator';
import { User } from '@/entities/user.entity';
import {
  CreateCommentDto,
  UpdateCommentDto,
  CommentQueryDto,
} from '@/dto/comment.dto';
import { ResponseUtil } from '@/common/utils/response.util';
import { ApiResponse as ApiResponseInterface } from '@/common/interfaces/response.interface';
import { Comment } from '@/entities/comment.entity';
import type { Request as ExpressRequest } from 'express';
// 扩展Comment类型以包含动态添加的isLiked属性
type CommentWithLikeStatus = Comment & {
  isLiked?: boolean;
  replies?: CommentWithLikeStatus[];
};

@ApiTags('用户评论')
@Controller('user/comments')
export class UserCommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建评论' })
  @ApiResponse({ status: 201, description: '评论创建成功' })
  async create(
    @Body() createCommentDto: CreateCommentDto,
    @CurrentUser() user: User,
    @Request() req: ExpressRequest,
  ): Promise<ApiResponseInterface<any>> {
    const ipAddress = req.ip || req.remoteAddress;
    const userAgent = req.get('User-Agent');

    const comment = await this.commentService.create(
      createCommentDto,
      user.id,
      ipAddress,
      userAgent,
    );

    return ResponseUtil.created(comment, '评论创建成功');
  }

  @Get()
  @Public()
  @ApiOperation({ summary: '获取评论列表' })
  @ApiResponse({ status: 200, description: '获取评论列表成功' })
  async findAll(
    @Query() query: CommentQueryDto,
    @CurrentUser() user?: User,
  ): Promise<ApiResponseInterface<any>> {
    const { comments, total } = await this.commentService.findAll(query);

    // 如果用户已登录，检查点赞状态
    if (user && comments.length > 0) {
      const commentIds = comments.map((comment) => comment.id);
      const likeStatus = await this.commentService.checkUserLikes(
        commentIds,
        user.id,
      );

      // 为每个评论添加点赞状态
      (comments as CommentWithLikeStatus[]).forEach((comment) => {
        comment.isLiked = likeStatus[comment.id] || false;
      });
    }

    return ResponseUtil.paginated(
      comments,
      total,
      query.page || 1,
      query.limit || 10,
      '获取评论列表成功',
    );
  }

  @Get('tree/:articleId')
  @Public()
  @ApiOperation({ summary: '获取文章评论树' })
  @ApiParam({ name: 'articleId', description: '文章ID' })
  @ApiResponse({ status: 200, description: '获取评论树成功' })
  async getCommentTree(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @CurrentUser() user?: User,
  ): Promise<ApiResponseInterface<any>> {
    const { comments, total } = await this.commentService.getCommentTree(
      articleId,
      page,
      limit,
    );

    // 如果用户已登录，检查点赞状态
    if (user && comments.length > 0) {
      const allCommentIds: string[] = [];

      // 收集所有评论ID（包括回复）
      comments.forEach((comment) => {
        allCommentIds.push(comment.id);
        if (comment.replies) {
          comment.replies.forEach((reply) => {
            allCommentIds.push(reply.id);
          });
        }
      });

      const likeStatus = await this.commentService.checkUserLikes(
        allCommentIds,
        user.id,
      );

      // 为所有评论添加点赞状态
      (comments as CommentWithLikeStatus[]).forEach((comment) => {
        comment.isLiked = likeStatus[comment.id] || false;
        if (comment.replies) {
          comment.replies.forEach((reply) => {
            reply.isLiked = likeStatus[reply.id] || false;
          });
        }
      });
    }

    return ResponseUtil.paginated(
      comments,
      total,
      page,
      limit,
      '获取评论树成功',
    );
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: '获取评论详情' })
  @ApiParam({ name: 'id', description: '评论ID' })
  @ApiResponse({ status: 200, description: '获取评论详情成功' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: User,
  ): Promise<ApiResponseInterface<any>> {
    const comment = await this.commentService.findById(id);

    // 如果用户已登录，检查点赞状态
    if (user) {
      const isLiked = await this.commentService.checkUserLike(id, user.id);
      (comment as CommentWithLikeStatus).isLiked = isLiked;
    }

    return ResponseUtil.success(comment, '获取评论详情成功');
  }

  @Get(':id/replies')
  @Public()
  @ApiOperation({ summary: '获取评论回复列表' })
  @ApiParam({ name: 'id', description: '评论ID' })
  @ApiResponse({ status: 200, description: '获取回复列表成功' })
  async getReplies(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CommentQueryDto,
    @CurrentUser() user?: User,
  ): Promise<ApiResponseInterface<any>> {
    const queryDto = new CommentQueryDto();
    Object.assign(queryDto, query);
    queryDto.parentId = id;
    const { comments, total } = await this.commentService.findAll(queryDto);

    // 如果用户已登录，检查点赞状态
    if (user && comments.length > 0) {
      const commentIds = comments.map((comment) => comment.id);
      const likeStatus = await this.commentService.checkUserLikes(
        commentIds,
        user.id,
      );

      (comments as CommentWithLikeStatus[]).forEach((comment) => {
        comment.isLiked = likeStatus[comment.id] || false;
      });
    }

    return ResponseUtil.paginated(
      comments,
      total,
      query.page || 1,
      query.limit || 10,
      '获取回复列表成功',
    );
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新评论' })
  @ApiParam({ name: 'id', description: '评论ID' })
  @ApiResponse({ status: 200, description: '评论更新成功' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @CurrentUser() user: User,
  ): Promise<ApiResponseInterface<any>> {
    const comment = await this.commentService.update(
      id,
      updateCommentDto,
      user.id,
      false,
    );

    return ResponseUtil.success(comment, '评论更新成功');
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除评论' })
  @ApiParam({ name: 'id', description: '评论ID' })
  @ApiResponse({ status: 204, description: '评论删除成功' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<ApiResponseInterface<null>> {
    await this.commentService.remove(id, user.id, false);
    return ResponseUtil.noContent('评论删除成功');
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '点赞/取消点赞评论' })
  @ApiParam({ name: 'id', description: '评论ID' })
  @ApiResponse({ status: 200, description: '操作成功' })
  async toggleLike(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<ApiResponseInterface<any>> {
    const result = await this.commentService.toggleLike(id, user.id);

    const message = result.liked ? '点赞成功' : '取消点赞成功';
    return ResponseUtil.success(result, message);
  }

  @Get('my/list')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取我的评论列表' })
  @ApiResponse({ status: 200, description: '获取我的评论列表成功' })
  async getMyComments(
    @Query() query: CommentQueryDto,
    @CurrentUser() user: User,
  ): Promise<ApiResponseInterface<any>> {
    const queryDto = new CommentQueryDto();
    Object.assign(queryDto, query);
    queryDto.authorId = user.id;
    const { comments, total } = await this.commentService.findAll(queryDto);

    return ResponseUtil.paginated(
      comments,
      total,
      query.page || 1,
      query.limit || 10,
      '获取我的评论列表成功',
    );
  }
}
