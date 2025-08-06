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
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ArticleService } from '@/services/article.service';
import { JwtAuthGuard } from '@/guards/auth.guard';
import { RolesGuard } from '@/guards/roles.guard';
import { Roles } from '@/decorators/roles.decorator';
import { CurrentUser } from '@/decorators/user.decorator';
import { Role } from '@/enums/role.enum';
import { AdminArticleDto, AdminArticleDetailDto } from '@/dto/base/admin.dto';
import {
  CreateArticleDto,
  UpdateArticleDto,
  ArticleQueryDto,
} from '@/dto/article.dto';
import { PublishArticleDto } from '@/dto/publish-article.dto';
import { plainToClass } from 'class-transformer';
interface CreateArticleWithAuthorDto extends CreateArticleDto {
  authorId: string;
}
@ApiTags('管理端API - 文章')
@Controller('admin/articles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth('JWT-auth')
@UseInterceptors(ClassSerializerInterceptor)
export class AdminArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Post()
  @ApiOperation({ summary: '创建文章' })
  @ApiResponse({
    status: 201,
    description: '创建成功',
    type: AdminArticleDetailDto,
  })
  async create(
    @Body() createArticleDto: CreateArticleWithAuthorDto,
    @CurrentUser() user: { sub: string },
  ) {
    // 设置作者为当前用户
    createArticleDto.authorId = user.sub;

    const article = await this.articleService.create(createArticleDto);
    return plainToClass(AdminArticleDetailDto, article, {
      excludeExtraneousValues: true,
    });
  }

  @Get()
  @ApiOperation({ summary: '获取文章列表（包含所有状态）' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: [AdminArticleDto],
  })
  async findAll(@Query() query: ArticleQueryDto) {
    const queryDto = new ArticleQueryDto();
    Object.assign(queryDto, query);
    const result = await this.articleService.findAll(queryDto);

    const page = Number(queryDto.page) || 1;
    const limit = Number(queryDto.limit) || 10;
    return {
      items: result.articles.map((article) =>
        plainToClass(AdminArticleDto, article, {
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

  @Get('drafts')
  @ApiOperation({ summary: '获取草稿文章' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: [AdminArticleDto],
  })
  async findDrafts(@Query() query: ArticleQueryDto) {
    const draftQuery = new ArticleQueryDto();
    Object.assign(draftQuery, query);
    draftQuery.status = 'draft';
    const result = await this.articleService.findAll(draftQuery);

    const page = Number(draftQuery.page) || 1;
    const limit = Number(draftQuery.limit) || 10;
    return {
      items: result.articles.map((article) =>
        plainToClass(AdminArticleDto, article, {
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

  @Get('published')
  @ApiOperation({ summary: '获取已发布文章' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: [AdminArticleDto],
  })
  async findPublished(@Query() query: ArticleQueryDto) {
    const publishedQuery = new ArticleQueryDto();
    Object.assign(publishedQuery, query);
    publishedQuery.status = 'published';
    const result = await this.articleService.findAll(publishedQuery);

    const page = Number(publishedQuery.page) || 1;
    const limit = Number(publishedQuery.limit) || 10;
    return {
      items: result.articles.map((article) =>
        plainToClass(AdminArticleDto, article, {
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

  @Get('archived')
  @ApiOperation({ summary: '获取归档文章' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: [AdminArticleDto],
  })
  async findArchived(@Query() query: ArticleQueryDto) {
    const archivedQuery = new ArticleQueryDto();
    Object.assign(archivedQuery, query);
    archivedQuery.status = 'archived';
    const result = await this.articleService.findAll(archivedQuery);

    const page = Number(archivedQuery.page) || 1;
    const limit = Number(archivedQuery.limit) || 10;
    return {
      items: result.articles.map((article) =>
        plainToClass(AdminArticleDto, article, {
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

  @Get('stats')
  @ApiOperation({ summary: '获取文章统计信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getStatistics(): Promise<Record<string, number>> {
    return await this.articleService.getStatistics();
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID获取文章详情（包含所有字段）' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: AdminArticleDetailDto,
  })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const article = await this.articleService.findById(id);
    return plainToClass(AdminArticleDetailDto, article, {
      excludeExtraneousValues: true,
    });
  }

  @Put(':id')
  @ApiOperation({ summary: '更新文章' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '更新成功',
    type: AdminArticleDetailDto,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateArticleDto: UpdateArticleDto,
  ) {
    const article = await this.articleService.update(id, updateArticleDto);
    return plainToClass(AdminArticleDetailDto, article, {
      excludeExtraneousValues: true,
    });
  }

  @Put(':id/publish')
  @ApiOperation({ summary: '发布文章' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '发布成功',
    type: AdminArticleDetailDto,
  })
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() publishDto: PublishArticleDto,
  ) {
    const article = await this.articleService.publish(id, publishDto);
    return plainToClass(AdminArticleDetailDto, article, {
      excludeExtraneousValues: true,
    });
  }

  @Put(':id/unpublish')
  @ApiOperation({ summary: '取消发布文章' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '取消发布成功',
    type: AdminArticleDetailDto,
  })
  async unpublish(@Param('id', ParseUUIDPipe) id: string) {
    const article = await this.articleService.unpublish(id);
    return plainToClass(AdminArticleDetailDto, article, {
      excludeExtraneousValues: true,
    });
  }

  @Put(':id/archive')
  @ApiOperation({ summary: '归档文章' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '归档成功',
    type: AdminArticleDetailDto,
  })
  async archive(@Param('id', ParseUUIDPipe) id: string) {
    const article = await this.articleService.archive(id);
    return plainToClass(AdminArticleDetailDto, article, {
      excludeExtraneousValues: true,
    });
  }

  @Put(':id/feature')
  @ApiOperation({ summary: '设置/取消精选文章' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '操作成功',
    type: AdminArticleDetailDto,
  })
  async toggleFeature(@Param('id', ParseUUIDPipe) id: string) {
    const article = await this.articleService.toggleFeature(id);
    return plainToClass(AdminArticleDetailDto, article, {
      excludeExtraneousValues: true,
    });
  }

  @Put(':id/top')
  @ApiOperation({ summary: '设置/取消置顶文章' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '操作成功',
    type: AdminArticleDetailDto,
  })
  async toggleTop(@Param('id', ParseUUIDPipe) id: string) {
    const article = await this.articleService.toggleTop(id);
    return plainToClass(AdminArticleDetailDto, article, {
      excludeExtraneousValues: true,
    });
  }

  @Put(':id/visible')
  @ApiOperation({ summary: '设置/取消文章可见性' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '操作成功',
    type: AdminArticleDetailDto,
  })
  async toggleVisible(@Param('id', ParseUUIDPipe) id: string) {
    const article = await this.articleService.toggleVisible(id);
    return plainToClass(AdminArticleDetailDto, article, {
      excludeExtraneousValues: true,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除文章' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.articleService.remove(id);
    return { message: '文章删除成功' };
  }

  @Delete('batch')
  @ApiOperation({ summary: '批量删除文章' })
  @ApiResponse({ status: 200, description: '批量删除成功' })
  async batchRemove(@Body('ids') ids: string[]) {
    await this.articleService.batchRemove(ids);
    return { message: `成功删除 ${ids.length} 篇文章` };
  }
}
