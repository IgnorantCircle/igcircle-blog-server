import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFiles,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/guards/auth.guard';
import { RolesGuard } from '@/guards/roles.guard';
import { Roles } from '@/decorators/roles.decorator';
import { CurrentUser } from '@/decorators/user.decorator';
import { Role } from '@/enums/role.enum';
import { ArticleImportService } from '@/services/article-import.service';
import {
  ArticleImportConfigDto,
  ArticleImportResponseDto,
  StartImportResponseDto,
  ImportProgressDto,
} from '@/dto/article-import.dto';
import { User } from '@/entities/user.entity';
import {
  ValidationException,
  NotFoundException,
} from '@/common/exceptions/business.exception';
import { ErrorCode } from '@/common/constants/error-codes';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

/**
 * 文章导入配置原始数据接口
 * 用于接收multipart/form-data中的配置数据
 */
interface RawImportConfigData {
  defaultCategory?: string;
  defaultTags?: string; // 逗号分隔的字符串
  autoPublish?: string | boolean;
  overwriteExisting?: string | boolean;
  importMode?: string;
  skipInvalidFiles?: string | boolean;
}

/**
 * 文件验证结果项接口
 */
interface FileValidationResultItem {
  filename: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  title?: string;
  hasContent: boolean;
}

/**
 * 文件验证响应接口
 */
interface FileValidationResponse {
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  results: FileValidationResultItem[];
}

@ApiTags('管理端 - 文章导入')
@Controller('admin/articles/import')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class ArticleImportController {
  constructor(private readonly articleImportService: ArticleImportService) {}

  /**
   * 文件上传配置
   */
  private static readonly FILE_UPLOAD_CONFIG: MulterOptions = {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB per file
      files: 100, // max 100 files
    },
    fileFilter: (req, file, callback) => {
      const allowedMimes = ['text/markdown', 'text/plain'];
      const allowedExts = ['.md', '.markdown'];

      const hasValidMime = allowedMimes.includes(file.mimetype);
      const hasValidExt = allowedExts.some((ext) =>
        file.originalname.toLowerCase().endsWith(ext),
      );

      if (hasValidMime || hasValidExt) {
        callback(null, true);
      } else {
        callback(
          new ValidationException(
            `不支持的文件类型: ${file.originalname}. 仅支持 .md 和 .markdown 文件`,
          ),
          false,
        );
      }
    },
  };

  /**
   * 导入API的通用Body Schema
   */
  private static readonly IMPORT_API_BODY_SCHEMA = {
    description: '文章文件和配置',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Markdown文件列表',
        },
        defaultCategory: {
          type: 'string',
          description: '默认分类名称',
          example: '技术博客',
        },
        defaultTags: {
          type: 'string',
          description: '默认标签列表（逗号分隔）',
          example: '技术,博客',
        },
        autoPublish: {
          type: 'boolean',
          description: '是否自动发布',
          default: false,
        },
        overwriteExisting: {
          type: 'boolean',
          description: '是否覆盖已存在的文章',
          default: false,
        },
        importMode: {
          type: 'string',
          enum: ['strict', 'loose'],
          description: '导入模式',
          default: 'loose',
        },
        skipInvalidFiles: {
          type: 'boolean',
          description: '是否跳过无效文件',
          default: true,
        },
      },
      required: ['files'],
    },
  };

  /**
   * 通用API响应配置
   */
  private static readonly COMMON_API_RESPONSES = [
    {
      status: 400,
      description: '请求参数错误',
    },
    {
      status: 401,
      description: '未授权',
    },
    {
      status: 403,
      description: '权限不足',
    },
  ];

  @Post()
  @ApiOperation({ summary: '导入文章' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(ArticleImportController.IMPORT_API_BODY_SCHEMA)
  @ApiResponse({
    status: 200,
    description: '导入成功',
    type: ArticleImportResponseDto,
  })
  @ApiResponse(ArticleImportController.COMMON_API_RESPONSES[0])
  @ApiResponse(ArticleImportController.COMMON_API_RESPONSES[1])
  @ApiResponse(ArticleImportController.COMMON_API_RESPONSES[2])
  @UseInterceptors(
    FilesInterceptor('files', 100, ArticleImportController.FILE_UPLOAD_CONFIG),
  )
  async importArticles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() configData: RawImportConfigData,
    @CurrentUser() user: User,
  ): Promise<ArticleImportResponseDto> {
    // 验证文件和解析配置
    const config = this.validateFilesAndParseConfig(files, configData, '导入');

    // 执行同步导入
    return await this.articleImportService.importArticlesSync(
      files,
      user.id,
      config,
    );
  }

  @Post('async')
  @ApiOperation({ summary: '异步导入文章' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(ArticleImportController.IMPORT_API_BODY_SCHEMA)
  @ApiResponse({
    status: 200,
    description: '导入任务已开始',
    type: StartImportResponseDto,
  })
  @ApiResponse(ArticleImportController.COMMON_API_RESPONSES[0])
  @ApiResponse(ArticleImportController.COMMON_API_RESPONSES[1])
  @ApiResponse(ArticleImportController.COMMON_API_RESPONSES[2])
  @UseInterceptors(
    FilesInterceptor('files', 100, ArticleImportController.FILE_UPLOAD_CONFIG),
  )
  async importArticlesAsync(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() configData: RawImportConfigData,
    @CurrentUser() user: User,
  ): Promise<StartImportResponseDto> {
    // 验证文件和解析配置
    const config = this.validateFilesAndParseConfig(files, configData, '导入');

    // 开始异步导入
    return await this.articleImportService.startImportArticles(
      files,
      user.id,
      config,
    );
  }

  @Get('progress/:taskId')
  @ApiOperation({ summary: '查询导入进度' })
  @ApiResponse({
    status: 200,
    description: '获取进度成功',
    type: ImportProgressDto,
  })
  @ApiResponse({
    status: 404,
    description: '任务不存在',
  })
  async getImportProgress(
    @Param('taskId') taskId: string,
  ): Promise<ImportProgressDto> {
    const progress = await this.articleImportService.getImportProgress(taskId);
    if (!progress) {
      throw new NotFoundException(
        ErrorCode.COMMON_NOT_FOUND,
        '导入任务不存在或已过期',
      );
    }
    return progress;
  }

  @Post('validate')
  @ApiOperation({ summary: '验证文章文件' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '要验证的文章文件',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Markdown文件列表',
        },
      },
      required: ['files'],
    },
  })
  @ApiResponse({
    status: 200,
    description: '验证完成',
    schema: {
      type: 'object',
      properties: {
        totalFiles: { type: 'number' },
        validFiles: { type: 'number' },
        invalidFiles: { type: 'number' },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              isValid: { type: 'boolean' },
              errors: { type: 'array', items: { type: 'string' } },
              warnings: { type: 'array', items: { type: 'string' } },
              title: { type: 'string' },
              hasContent: { type: 'boolean' },
            },
          },
        },
      },
    },
  })
  @ApiResponse(ArticleImportController.COMMON_API_RESPONSES[0])
  @ApiResponse(ArticleImportController.COMMON_API_RESPONSES[1])
  @ApiResponse(ArticleImportController.COMMON_API_RESPONSES[2])
  @UseInterceptors(
    FilesInterceptor('files', 100, ArticleImportController.FILE_UPLOAD_CONFIG),
  )
  validateFiles(
    @UploadedFiles() files: Express.Multer.File[],
  ): FileValidationResponse {
    this.validateFiles_Internal(files, '验证');

    const results = files.map((file): FileValidationResultItem => {
      try {
        const content = file.buffer.toString('utf-8');
        const validation = this.articleImportService['validateAndParseFile'](
          content,
          file.originalname,
        );

        return {
          filename: file.originalname,
          isValid: validation.isValid,
          errors: validation.errors,
          warnings: validation.warnings,
          title: validation.data?.title,
          hasContent: Boolean(validation.data?.content?.trim()),
        };
      } catch (error) {
        return {
          filename: file.originalname,
          isValid: false,
          errors: [error instanceof Error ? error.message : '验证失败'],
          warnings: [],
          title: undefined,
          hasContent: false,
        };
      }
    });

    const validFiles = results.filter((r) => r.isValid).length;
    const invalidFiles = results.filter((r) => !r.isValid).length;

    return {
      totalFiles: files.length,
      validFiles,
      invalidFiles,
      results,
    };
  }

  /**
   * 验证文件并解析配置（公共方法）
   */
  private validateFilesAndParseConfig(
    files: Express.Multer.File[],
    configData: RawImportConfigData,
    action: string,
  ): ArticleImportConfigDto {
    // 验证文件
    this.validateFiles_Internal(files, action);

    // 解析配置
    const config: ArticleImportConfigDto = this.parseConfig(configData);

    // 验证配置
    this.validateConfig(config);

    return config;
  }

  /**
   * 验证文件（内部方法）
   */
  private validateFiles_Internal(
    files: Express.Multer.File[],
    action: string,
  ): void {
    if (!files || files.length === 0) {
      throw new ValidationException(`请选择要${action}的文件`);
    }
  }

  /**
   * 解析配置数据
   */
  private parseConfig(configData: RawImportConfigData): ArticleImportConfigDto {
    const defaultCategory: string | undefined = configData?.defaultCategory;

    const defaultTags: string[] | undefined = configData?.defaultTags
      ? String(configData.defaultTags)
          .split(',')
          .map((tag: string) => tag.trim())
          .filter((tag: string) => tag.length > 0)
      : undefined;

    const autoPublish: boolean =
      configData?.autoPublish === 'true' || configData?.autoPublish === true;

    const overwriteExisting: boolean =
      configData?.overwriteExisting === 'true' ||
      configData?.overwriteExisting === true;

    const importMode: 'strict' | 'loose' =
      configData?.importMode === 'strict' ? 'strict' : 'loose';

    const skipInvalidFiles: boolean =
      configData?.skipInvalidFiles !== 'false' &&
      configData?.skipInvalidFiles !== false;

    return {
      defaultCategory,
      defaultTags,
      autoPublish,
      overwriteExisting,
      importMode,
      skipInvalidFiles,
    };
  }

  /**
   * 验证导入配置
   */
  private validateConfig(config: ArticleImportConfigDto): void {
    if (config.importMode && !['strict', 'loose'].includes(config.importMode)) {
      throw new ValidationException('导入模式只能是 strict 或 loose');
    }

    if (config.defaultTags && config.defaultTags.length > 10) {
      throw new ValidationException('默认标签数量不能超过10个');
    }

    if (config.defaultCategory && config.defaultCategory.length > 50) {
      throw new ValidationException('默认分类名称不能超过50个字符');
    }
  }
}
