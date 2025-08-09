import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ArticleService } from '@/services/article/article.service';
import { ArticleQueryService } from '@/services/article/article-query.service';
import { Public } from '@/decorators/public.decorator';
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

@ApiTags('公共API - 文章')
@Controller('articles')
@Public()
@UseInterceptors(FieldVisibilityInterceptor)
export class PublicArticleController {
  constructor(
    private readonly articleService: ArticleService,
    private readonly articleQueryService: ArticleQueryService,
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
    const archiveQuery = new ArticleQueryDto();
    Object.assign(archiveQuery, query);
    archiveQuery.status = ArticleStatus.PUBLISHED;
    const result = await this.articleService.findAllPaginated(archiveQuery);

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    return PaginationUtil.fromQueryResult(result, page, limit);
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
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<any> {
    const article = await this.articleService.findById(id);

    // 只返回已发布且可见的文章
    if (article.status !== 'published' || !article.isVisible) {
      throw new NotFoundException(
        ErrorCode.ARTICLE_NOT_FOUND,
        '文章不存在或不可访问',
      );
    }

    // 增加浏览次数
    await this.articleService.incrementViews(id);

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
  async findBySlug(@Param('slug') slug: string): Promise<any> {
    const article = await this.articleService.findBySlug(slug);

    // 只返回已发布且可见的文章
    if (article.status !== 'published' || !article.isVisible) {
      throw new NotFoundException(
        ErrorCode.ARTICLE_NOT_FOUND,
        '文章不存在或不可访问',
      );
    }

    // 增加浏览次数
    await this.articleService.incrementViews(article.id);

    return article;
  }
}
