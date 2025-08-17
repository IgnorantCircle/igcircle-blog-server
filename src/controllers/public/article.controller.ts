import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { ArticleService } from '@/services/article/article.service';
import { ArticleQueryService } from '@/services/article/article-query.service';
import { ArticleStatisticsService } from '@/services/article/article-statistics.service';
import { ArticleInteractionService } from '@/services/article/article-interaction.service';
import { Public } from '@/decorators/public.decorator';
import { CurrentUser } from '@/decorators/user.decorator';
import {
  UnifiedArticleDto,
  UnifiedArticleDetailDto,
} from '@/dto/base/unified-response.dto';
import { ArticleQueryDto, ArticleStatus } from '@/dto/article.dto';
import {
  FieldVisibilityInterceptor,
  UsePublicVisibility,
} from '@/common/interceptors/field-visibility.interceptor';
import { NotFoundException } from '@/common/exceptions/business.exception';
import { ErrorCode } from '@/common/constants/error-codes';
import { PaginationUtil } from '@/common/utils/pagination.util';
import { Article } from '@/entities/article.entity';

interface CurrentUserType {
  sub: string;
  username: string;
  email: string;
  role: string;
}

@ApiTags('3.1 公共API - 文章')
@Controller('articles')
@Public()
@UseInterceptors(FieldVisibilityInterceptor)
export class PublicArticleController {
  constructor(
    private readonly articleService: ArticleService,
    private readonly articleQueryService: ArticleQueryService,
    private readonly articleStatisticsService: ArticleStatisticsService,
    private readonly articleInteractionService: ArticleInteractionService,
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
  ) {}

  @Get()
  @UsePublicVisibility()
  @ApiOperation({ summary: '获取已发布文章列表' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: [UnifiedArticleDto],
  })
  async findPublished(@Query() query: ArticleQueryDto) {
    // 强制只返回已发布且可见的文章
    const publishedQuery = new ArticleQueryDto();
    Object.assign(publishedQuery, query);
    publishedQuery.status = ArticleStatus.PUBLISHED;
    const result = await this.articleService.findAllPaginated(publishedQuery);
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    return PaginationUtil.fromQueryResult(result, page, limit);
  }

  @Get('featured')
  @UsePublicVisibility()
  @ApiOperation({ summary: '获取精选文章' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: [UnifiedArticleDto],
  })
  async findFeatured(@Query('limit') limitStr?: string) {
    const limit = limitStr ? parseInt(limitStr, 10) : 6;
    const articles = await this.articleService.getFeatured(limit);
    return articles;
  }

  @Get('recent')
  @UsePublicVisibility()
  @ApiOperation({ summary: '获取最新文章' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: [UnifiedArticleDto],
  })
  async findRecent(@Query('limit') limitStr?: string) {
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    const articles = await this.articleService.getRecent(limit);
    return articles;
  }

  @Get('popular')
  @UsePublicVisibility()
  @ApiOperation({ summary: '获取热门文章' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: [UnifiedArticleDto],
  })
  async findPopular(@Query('limit') limitStr?: string) {
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    const articles = await this.articleService.getPopular(limit);
    return articles;
  }

  @Get('search')
  @UsePublicVisibility()
  @ApiOperation({ summary: '搜索文章' })
  @ApiResponse({
    status: 200,
    description: '搜索成功',
    type: [UnifiedArticleDto],
  })
  async search(@Query() query: ArticleQueryDto) {
    // 强制只返回已发布的文章
    const searchQuery = new ArticleQueryDto();
    Object.assign(searchQuery, query);
    searchQuery.status = ArticleStatus.PUBLISHED;
    const result = await this.articleService.findAllPaginated(searchQuery);

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    return PaginationUtil.fromQueryResult(result, page, limit);
  }

  @Get('archive')
  @ApiOperation({ summary: '获取文章归档' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getArchive(@Query() query: ArticleQueryDto): Promise<any> {
    // 强制只返回已发布的文章
    query.status = ArticleStatus.PUBLISHED;
    const result = await this.articleService.findAllPaginated(query);

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    return PaginationUtil.fromQueryResult(result, page, limit);
  }

  @Get('archive/stats')
  @ApiOperation({ summary: '获取文章统计信息（用户端）' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getStatistics() {
    return this.articleStatisticsService.getPublicStatistics();
  }

  @Get(':id')
  @UsePublicVisibility()
  @ApiOperation({ summary: '根据ID获取文章详情' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: UnifiedArticleDetailDto,
  })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @CurrentUser() user?: CurrentUserType,
  ): Promise<any> {
    const article = await this.articleService.findById(id);

    // 只返回已发布且可见的文章
    if (article.status !== 'published' || !article.isVisible) {
      throw new NotFoundException(
        ErrorCode.ARTICLE_NOT_FOUND,
        '文章不存在或不可访问',
      );
    }

    // 记录浏览次数（避免重复计数）
    const ipAddress = this.getClientIp(req);
    const userAgent = req.get('User-Agent') || null;
    const isAdmin = user?.role === 'admin';

    await this.articleInteractionService.recordView(
      id,
      user?.sub || null,
      ipAddress,
      userAgent,
      isAdmin,
    );

    // 如果用户已登录，添加点赞收藏状态
    if (user) {
      const [isLiked, isFavorited] = await Promise.all([
        this.articleInteractionService.checkUserLike(user.sub, id),
        this.articleInteractionService.checkUserFavorite(user.sub, id),
      ]);
      return {
        ...article,
        isLiked,
        isFavorited,
      };
    }

    return article;
  }

  @Get('slug/:slug')
  @UsePublicVisibility()
  @ApiOperation({ summary: '根据slug获取文章详情' })
  @ApiParam({ name: 'slug', description: '文章slug' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: UnifiedArticleDetailDto,
  })
  async findBySlug(
    @Param('slug') slug: string,
    @Req() req: Request,
    @CurrentUser() user?: CurrentUserType,
  ): Promise<any> {
    const article = await this.articleService.findBySlug(slug);

    // 只返回已发布且可见的文章
    if (article.status !== 'published' || !article.isVisible) {
      throw new NotFoundException(
        ErrorCode.ARTICLE_NOT_FOUND,
        '文章不存在或不可访问',
      );
    }

    // 记录浏览次数（避免重复计数）
    const ipAddress = this.getClientIp(req);
    const userAgent = req.get('User-Agent') || null;
    const isAdmin = user?.role === 'admin';

    await this.articleInteractionService.recordView(
      article.id,
      user?.sub || null,
      ipAddress,
      userAgent,
      isAdmin,
    );

    // 如果用户已登录，添加点赞收藏状态
    if (user) {
      const [isLiked, isFavorited] = await Promise.all([
        this.articleInteractionService.checkUserLike(user.sub, article.id),
        this.articleInteractionService.checkUserFavorite(user.sub, article.id),
      ]);
      return {
        ...article,
        isLiked,
        isFavorited,
      };
    }

    return article;
  }

  @Get(':id/related')
  @UsePublicVisibility()
  @ApiOperation({ summary: '获取相关文章' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: [UnifiedArticleDto],
  })
  async getRelated(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limitStr?: string,
  ): Promise<Article[]> {
    const limit = limitStr ? parseInt(limitStr, 10) : 4;
    return await this.articleService.getRelated(id, limit);
  }

  /**
   * 获取客户端真实IP地址
   */
  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      '127.0.0.1'
    );
  }
}
