import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  ParseUUIDPipe,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ArticleService } from '@/services/article.service';
import { Public } from '@/decorators/public.decorator';
import {
  PublicArticleDto,
  PublicArticleDetailDto,
} from '@/dto/base/public.dto';
import {
  ArticleQueryDto,
  ArticleSearchDto,
  ArticleArchiveDto,
} from '@/dto/article.dto';
import { plainToClass } from 'class-transformer';

@ApiTags('公共API - 文章')
@Controller('articles')
@Public()
@UseInterceptors(ClassSerializerInterceptor)
export class PublicArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Get()
  @ApiOperation({ summary: '获取已发布文章列表' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: [PublicArticleDto],
  })
  async findPublished(@Query() query: ArticleQueryDto) {
    // 强制只返回已发布且可见的文章
    const publishedQuery = new ArticleQueryDto();
    Object.assign(publishedQuery, query);
    publishedQuery.status = 'published';
    publishedQuery.isVisible = true;
    const result = await this.articleService.findAll(publishedQuery);

    const page = Number(publishedQuery.page) || 1;
    const limit = Number(publishedQuery.limit) || 10;
    return {
      items: result.items.map((article) =>
        plainToClass(PublicArticleDto, article, {
          excludeExtraneousValues: true,
        }),
      ),
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
      hasNext: page < Math.ceil(result.total / limit),
      hasPrev: page > 1,
    };
  }

  @Get('featured')
  @ApiOperation({ summary: '获取精选文章' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: [PublicArticleDto],
  })
  async findFeatured(@Query('limit', ParseIntPipe) limit: number = 6) {
    const articles = await this.articleService.getFeatured(limit);
    return articles.map((article) =>
      plainToClass(PublicArticleDto, article, {
        excludeExtraneousValues: true,
      }),
    );
  }

  @Get('recent')
  @ApiOperation({ summary: '获取最新文章' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: [PublicArticleDto],
  })
  async findRecent(@Query('limit', ParseIntPipe) limit: number = 10) {
    const articles = await this.articleService.getRecent(limit);
    return articles.map((article) =>
      plainToClass(PublicArticleDto, article, {
        excludeExtraneousValues: true,
      }),
    );
  }

  @Get('popular')
  @ApiOperation({ summary: '获取热门文章' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: [PublicArticleDto],
  })
  async findPopular(@Query('limit', ParseIntPipe) limit: number = 10) {
    const articles = await this.articleService.getPopular(limit);
    return articles.map((article) =>
      plainToClass(PublicArticleDto, article, {
        excludeExtraneousValues: true,
      }),
    );
  }

  @Get('search')
  @ApiOperation({ summary: '搜索文章' })
  @ApiResponse({
    status: 200,
    description: '搜索成功',
    type: [PublicArticleDto],
  })
  async search(@Query() searchDto: ArticleSearchDto) {
    const result = await this.articleService.search(searchDto);
    return {
      ...result,
      items: result.articles.map((article) =>
        plainToClass(PublicArticleDto, article, {
          excludeExtraneousValues: true,
        }),
      ),
    };
  }

  @Get('archive')
  @ApiOperation({ summary: '获取文章归档' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getArchive(@Query() archiveDto: ArticleArchiveDto) {
    return await this.articleService.getArchive(archiveDto);
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID获取文章详情' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: PublicArticleDetailDto,
  })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const article = await this.articleService.findById(id);

    // 只返回已发布且可见的文章
    if (article.status !== 'published' || !article.isVisible) {
      throw new Error('文章不存在或不可访问');
    }

    // 增加浏览次数
    await this.articleService.incrementViews(id);

    return plainToClass(PublicArticleDetailDto, article, {
      excludeExtraneousValues: true,
    });
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: '根据slug获取文章详情' })
  @ApiParam({ name: 'slug', description: '文章slug' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: PublicArticleDetailDto,
  })
  async findBySlug(@Param('slug') slug: string) {
    const article = await this.articleService.findBySlug(slug);

    // 只返回已发布且可见的文章
    if (article.status !== 'published' || !article.isVisible) {
      throw new Error('文章不存在或不可访问');
    }

    // 增加浏览次数
    await this.articleService.incrementViews(article.id);

    return plainToClass(PublicArticleDetailDto, article, {
      excludeExtraneousValues: true,
    });
  }
}
