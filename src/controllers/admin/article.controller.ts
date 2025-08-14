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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import archiver from 'archiver';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ArticleService } from '@/services/article/article.service';
import { ArticleStatisticsService } from '@/services/article/article-statistics.service';

import { RolesGuard } from '@/guards/roles.guard';
import { Roles } from '@/decorators/roles.decorator';
import { CurrentUser } from '@/decorators/user.decorator';
import { Role } from '@/enums/role.enum';
import {
  UnifiedArticleDto,
  UnifiedArticleDetailDto,
} from '@/dto/base/unified-response.dto';
import {
  CreateArticleDto,
  UpdateArticleDto,
  ArticleQueryDto,
  ArticleStatus,
  BatchArticleOperationDto,
  BatchUpdateArticleDto,
  BatchPublishArticleDto,
  BatchExportArticleDto,
} from '@/dto/article.dto';
import { PublishArticleDto } from '@/dto/publish-article.dto';
import {
  FieldVisibilityInterceptor,
  UseAdminVisibility,
} from '@/common/interceptors/field-visibility.interceptor';
import { Article } from '@/entities/article.entity';
import { PaginationUtil } from '@/common/utils/pagination.util';
import { PaginatedResponse } from '@/common/interfaces/response.interface';

interface CurrentUserType {
  sub: string;
  username: string;
  email: string;
  role: string;
}

// 定义batchExport方法的返回值类型
type BatchExportResult =
  | string
  | { files: { filename: string; content: string }[] }
  | Record<string, unknown>[];

@ApiTags('管理端API - 文章')
@Controller('admin/articles')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth('JWT-auth')
@UseInterceptors(FieldVisibilityInterceptor)
export class AdminArticleController {
  constructor(
    private readonly articleService: ArticleService,
    private readonly articleStatisticsService: ArticleStatisticsService,
  ) {}

  @Post()
  @UseAdminVisibility()
  @ApiOperation({ summary: '创建文章' })
  @ApiResponse({
    status: 201,
    description: '创建成功',
    type: UnifiedArticleDetailDto,
  })
  async create(
    @Body() createArticleDto: CreateArticleDto,
    @CurrentUser() user: CurrentUserType,
  ): Promise<Article> {
    const articleData = {
      ...createArticleDto,
      authorId: user.sub,
    };
    const article = await this.articleService.create(articleData);
    return article;
  }

  @Get()
  @UseAdminVisibility()
  @ApiOperation({ summary: '获取文章列表（包含所有状态）' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: [UnifiedArticleDto],
  })
  async findAll(
    @Query() query: ArticleQueryDto,
  ): Promise<PaginatedResponse<Article>> {
    const queryDto = new ArticleQueryDto();
    Object.assign(queryDto, query);
    const result = await this.articleService.findAllPaginated(queryDto);
    return PaginationUtil.fromQueryResult(
      result,
      queryDto.page || 1,
      queryDto.limit || 10,
    );
  }

  @Get('drafts')
  @UseAdminVisibility()
  @ApiOperation({ summary: '获取草稿文章' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: [UnifiedArticleDto],
  })
  async findDrafts(
    @Query() query: ArticleQueryDto,
  ): Promise<PaginatedResponse<Article>> {
    const draftQuery = new ArticleQueryDto();
    Object.assign(draftQuery, query, { status: ArticleStatus.DRAFT });
    const result = await this.articleService.findAllPaginated(draftQuery);
    return PaginationUtil.fromQueryResult(
      result,
      draftQuery.page || 1,
      draftQuery.limit || 10,
    );
  }

  @Get('published')
  @UseAdminVisibility()
  @ApiOperation({ summary: '获取已发布文章' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: [UnifiedArticleDto],
  })
  async findPublished(
    @Query() query: ArticleQueryDto,
  ): Promise<PaginatedResponse<Article>> {
    const publishedQuery = new ArticleQueryDto();
    Object.assign(publishedQuery, query, { status: ArticleStatus.PUBLISHED });
    const result = await this.articleService.findAllPaginated(publishedQuery);
    return PaginationUtil.fromQueryResult(
      result,
      publishedQuery.page || 1,
      publishedQuery.limit || 10,
    );
  }

  @Get('archived')
  @UseAdminVisibility()
  @ApiOperation({ summary: '获取归档文章' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: [UnifiedArticleDto],
  })
  async findArchived(
    @Query() query: ArticleQueryDto,
  ): Promise<PaginatedResponse<Article>> {
    const archivedQuery = new ArticleQueryDto();
    Object.assign(archivedQuery, query, { status: ArticleStatus.ARCHIVED });
    const result = await this.articleService.findAllPaginated(archivedQuery);
    return PaginationUtil.fromQueryResult(
      result,
      archivedQuery.page || 1,
      archivedQuery.limit || 10,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: '获取文章统计信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getStatistics(): Promise<unknown> {
    return await this.articleStatisticsService.getAdminStatistics();
  }

  @Get(':id')
  @UseAdminVisibility()
  @ApiOperation({ summary: '根据ID获取文章详情（包含所有字段）' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: UnifiedArticleDetailDto,
  })
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<Article> {
    const article = await this.articleService.findById(id);
    return article;
  }

  @Put(':id')
  @UseAdminVisibility()
  @ApiOperation({ summary: '更新文章' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '更新成功',
    type: UnifiedArticleDetailDto,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateArticleDto: UpdateArticleDto,
  ): Promise<Article> {
    const article = await this.articleService.update(id, updateArticleDto);
    return article;
  }

  // 批量操作路由 - 必须放在参数化路由之前
  @Delete('batch')
  @ApiOperation({ summary: '批量删除文章' })
  @ApiResponse({ status: 200, description: '批量删除成功' })
  async batchRemove(
    @Body() batchDto: BatchArticleOperationDto,
  ): Promise<{ message: string }> {
    await this.articleService.batchRemove(batchDto.ids);
    return { message: `成功删除 ${batchDto.ids.length} 篇文章` };
  }

  @Put('batch/publish')
  @ApiOperation({ summary: '批量发布文章' })
  @ApiResponse({ status: 200, description: '批量发布成功' })
  async batchPublish(
    @Body() batchPublishDto: BatchPublishArticleDto,
  ): Promise<{ message: string }> {
    if (batchPublishDto.publishedAt) {
      await this.articleService.batchPublishWithDate(batchPublishDto);
    } else {
      await this.articleService.batchPublish(batchPublishDto.ids);
    }
    return { message: `成功发布 ${batchPublishDto.ids.length} 篇文章` };
  }

  @Put('batch/archive')
  @ApiOperation({ summary: '批量归档文章' })
  @ApiResponse({ status: 200, description: '批量归档成功' })
  async batchArchive(
    @Body() batchDto: BatchArticleOperationDto,
  ): Promise<{ message: string }> {
    await this.articleService.batchArchive(batchDto.ids);
    return { message: `成功归档 ${batchDto.ids.length} 篇文章` };
  }

  @Put('batch/update')
  @ApiOperation({ summary: '批量更新文章' })
  @ApiResponse({ status: 200, description: '批量更新成功' })
  async batchUpdate(
    @Body() batchUpdateDto: BatchUpdateArticleDto,
  ): Promise<{ message: string }> {
    await this.articleService.batchUpdate(batchUpdateDto);
    return { message: `成功更新 ${batchUpdateDto.ids.length} 篇文章` };
  }

  // 单个文章操作路由 - 放在批量操作之后
  @Put(':id/publish')
  @UseAdminVisibility()
  @ApiOperation({ summary: '发布文章' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '发布成功',
    type: UnifiedArticleDetailDto,
  })
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() publishDto: PublishArticleDto,
  ): Promise<Article> {
    const article = await this.articleService.publish(id, publishDto);
    return article;
  }

  @Put(':id/unpublish')
  @UseAdminVisibility()
  @ApiOperation({ summary: '取消发布文章' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '取消发布成功',
    type: UnifiedArticleDetailDto,
  })
  async unpublish(@Param('id', ParseUUIDPipe) id: string): Promise<Article> {
    const article = await this.articleService.unpublish(id);
    return article;
  }

  @Put(':id/archive')
  @UseAdminVisibility()
  @ApiOperation({ summary: '归档文章' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '归档成功',
    type: UnifiedArticleDetailDto,
  })
  async archive(@Param('id', ParseUUIDPipe) id: string): Promise<Article> {
    const article = await this.articleService.archive(id);
    return article;
  }

  @Put(':id/feature')
  @UseAdminVisibility()
  @ApiOperation({ summary: '设置/取消精选文章' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '操作成功',
    type: UnifiedArticleDetailDto,
  })
  async toggleFeature(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Article> {
    const article = await this.articleService.toggleFeature(id);
    return article;
  }

  @Put(':id/top')
  @UseAdminVisibility()
  @ApiOperation({ summary: '设置/取消置顶文章' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '操作成功',
    type: UnifiedArticleDetailDto,
  })
  async toggleTop(@Param('id', ParseUUIDPipe) id: string): Promise<Article> {
    const article = await this.articleService.toggleTop(id);
    return article;
  }

  @Put(':id/visible')
  @UseAdminVisibility()
  @ApiOperation({ summary: '设置/取消文章可见性' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({
    status: 200,
    description: '操作成功',
    type: UnifiedArticleDetailDto,
  })
  async toggleVisible(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Article> {
    const article = await this.articleService.toggleVisible(id);
    return article;
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除文章' })
  @ApiParam({ name: 'id', description: '文章ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.articleService.remove(id);
    return { message: '文章删除成功' };
  }

  @Post('batch/export')
  @ApiOperation({ summary: '批量导出文章' })
  @ApiResponse({ status: 200, description: '导出成功' })
  async batchExport(
    @Body() exportDto: BatchExportArticleDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<any> {
    const result = (await this.articleService.batchExport(
      exportDto,
    )) as BatchExportResult;

    // 检查是否是多文件导出（markdown格式且返回files数组）
    if (
      exportDto.format === 'markdown' &&
      typeof result === 'object' &&
      result !== null &&
      'files' in result &&
      Array.isArray(
        (result as { files: { filename: string; content: string }[] }).files,
      )
    ) {
      // 创建zip压缩包
      const archive = archiver('zip', {
        zlib: { level: 9 }, // 压缩级别
      });

      const filename = `articles_export_${new Date().toISOString().split('T')[0]}.zip`;

      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });

      archive.pipe(res);

      // 添加每个文件到压缩包
      (
        result as { files: { filename: string; content: string }[] }
      ).files.forEach((file) => {
        archive.append(file.content, { name: file.filename });
      });

      await archive.finalize();
      return;
    }

    // 单文件导出的情况
    if (exportDto.format === 'csv' || exportDto.format === 'markdown') {
      return {
        data: result as string,
        format: exportDto.format,
        filename: `articles_export_${new Date().toISOString().split('T')[0]}.${exportDto.format}`,
      };
    }

    return {
      data: result as Record<string, unknown>[],
      format: 'json',
      count: Array.isArray(result) ? result.length : 0,
    };
  }
}
