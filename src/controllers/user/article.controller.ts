import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ArticleInteractionService } from '@/services/article/article-interaction.service';
import { JwtAuthGuard } from '@/guards/auth.guard';
import { CurrentUser } from '@/decorators/user.decorator';
import { Article } from '@/entities/article.entity';
import { PaginatedResponse } from '@/common/interfaces/response.interface';
import { PaginationUtil } from '@/common/utils/pagination.util';

interface CurrentUserType {
  id: string;
  sub: string;
  username: string;
  email: string;
}

@ApiTags('2.1 用户端API - 文章操作')
@Controller('user/articles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserArticleController {
  constructor(
    private readonly articleInteractionService: ArticleInteractionService,
  ) {}

  @Post(':id/like')
  @ApiOperation({ summary: '切换文章点赞状态' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '操作成功',
    schema: {
      type: 'object',
      properties: {
        isLiked: {
          type: 'boolean',
          description: '当前点赞状态',
        },
        message: {
          type: 'string',
          description: '操作结果消息',
        },
      },
    },
  })
  async toggleLike(
    @Param('id', ParseUUIDPipe) articleId: string,
    @CurrentUser() user: CurrentUserType,
  ): Promise<{ isLiked: boolean; message: string }> {
    const isLiked = await this.articleInteractionService.toggleLike(
      articleId,
      user.id,
    );
    return {
      isLiked,
      message: isLiked ? '点赞成功' : '取消点赞成功',
    };
  }

  @Post(':id/favorite')
  @ApiOperation({ summary: '切换文章收藏状态' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '操作成功',
    schema: {
      type: 'object',
      properties: {
        isFavorited: {
          type: 'boolean',
          description: '当前收藏状态',
        },
        message: {
          type: 'string',
          description: '操作结果消息',
        },
      },
    },
  })
  async toggleFavorite(
    @Param('id', ParseUUIDPipe) articleId: string,
    @CurrentUser() user: CurrentUserType,
  ): Promise<{ isFavorited: boolean; message: string }> {
    const isFavorited = await this.articleInteractionService.toggleFavorite(
      articleId,
      user.id,
    );
    return {
      isFavorited,
      message: isFavorited ? '收藏成功' : '取消收藏成功',
    };
  }

  @Get('liked')
  @ApiOperation({ summary: '获取用户点赞的文章列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码', example: 1 })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '每页数量',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getLikedArticles(
    @CurrentUser() user: CurrentUserType,
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 10,
  ): Promise<PaginatedResponse<Article>> {
    const result = await this.articleInteractionService.getUserLikedArticles(
      user.id,
      page,
      limit,
    );

    return PaginationUtil.fromQueryResult(result, page, limit);
  }

  @Get('favorites')
  @ApiOperation({ summary: '获取用户收藏的文章列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码', example: 1 })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '每页数量',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getFavoriteArticles(
    @CurrentUser() user: CurrentUserType,
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 10,
  ): Promise<PaginatedResponse<Article>> {
    const result = await this.articleInteractionService.getUserFavoriteArticles(
      user.id,
      page,
      limit,
    );

    return PaginationUtil.fromQueryResult(result, page, limit);
  }

  @Get(':id/status')
  @ApiOperation({ summary: '获取用户对文章的操作状态（点赞、收藏）' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    schema: {
      type: 'object',
      properties: {
        isLiked: {
          type: 'boolean',
          description: '是否已点赞',
        },
        isFavorited: {
          type: 'boolean',
          description: '是否已收藏',
        },
      },
    },
  })
  async getArticleStatus(
    @Param('id', ParseUUIDPipe) articleId: string,
    @CurrentUser() user: CurrentUserType,
  ): Promise<{ isLiked: boolean; isFavorited: boolean }> {
    const [isLiked, isFavorited] = await Promise.all([
      this.articleInteractionService.checkUserLike(articleId, user.id),
      this.articleInteractionService.checkUserFavorite(articleId, user.id),
    ]);

    return { isLiked, isFavorited };
  }
}
