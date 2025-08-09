import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Article } from '@/entities/article.entity';

/**
 * 文章导入配置DTO
 */
export class ArticleImportConfigDto {
  @ApiPropertyOptional({
    description: '默认分类名称',
    example: '技术博客',
  })
  @IsOptional()
  @IsString()
  defaultCategory?: string;

  @ApiPropertyOptional({
    description: '默认标签列表',
    type: [String],
    example: ['技术', '博客'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defaultTags?: string[];

  @ApiPropertyOptional({
    description: '是否自动发布',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  autoPublish?: boolean;

  @ApiPropertyOptional({
    description: '是否覆盖已存在的文章（基于slug）',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  overwriteExisting?: boolean;

  @ApiPropertyOptional({
    description: '导入模式',
    enum: ['strict', 'loose'],
    default: 'loose',
  })
  @IsOptional()
  @IsEnum(['strict', 'loose'])
  importMode?: 'strict' | 'loose';

  @ApiPropertyOptional({
    description: '是否跳过无效文件',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  skipInvalidFiles?: boolean;
}

/**
 * 单个文章导入结果
 */
export class ArticleImportResultDto {
  @ApiProperty({ description: '文件路径' })
  filePath: string;

  @ApiProperty({ description: '是否成功' })
  @Type(() => Boolean)
  success: boolean;

  @ApiPropertyOptional({ description: '是否跳过' })
  skipped?: boolean;

  @ApiPropertyOptional({ description: '文章ID（成功时）' })
  articleId?: string;

  @ApiPropertyOptional({ description: '文章标题' })
  title?: string;

  @ApiPropertyOptional({ description: '错误信息（失败时）' })
  error?: string;

  @ApiPropertyOptional({ description: '警告信息' })
  warnings?: string[];
}

/**
 * 文章导入响应DTO
 */
export class ArticleImportResponseDto {
  @ApiProperty({ description: '总文件数' })
  totalFiles: number;

  @ApiProperty({ description: '成功导入数' })
  successCount: number;

  @ApiProperty({ description: '失败数' })
  failureCount: number;

  @ApiProperty({ description: '跳过数' })
  skippedCount: number;

  @ApiProperty({
    description: '详细结果',
    type: [ArticleImportResultDto],
  })
  @Type(() => ArticleImportResultDto)
  results: ArticleImportResultDto[];

  @ApiProperty({ description: '导入开始时间' })
  startTime: number;

  @ApiProperty({ description: '导入结束时间' })
  endTime: number;

  @ApiProperty({ description: '耗时（毫秒）' })
  duration: number;
}

/**
 * 解析的文章数据 - 基于Article实体
 */
export interface ParsedArticleData
  extends Partial<
    Pick<
      Article,
      | 'title'
      | 'summary'
      | 'slug'
      | 'coverImage'
      | 'publishedAt'
      | 'createdAt'
      | 'updatedAt'
      | 'status'
      | 'isFeatured'
      | 'isTop'
      | 'allowComment'
      | 'metaDescription'
      | 'metaKeywords'
      | 'socialImage'
      | 'readingTime'
      | 'weight'
    >
  > {
  title: string; // 必填字段
  content: string; // 必填字段
  tags?: string[]; // 标签名称数组
  category?: string; // 分类名称
}

/**
 * 文件验证结果
 */
export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: ParsedArticleData;
}

/**
 * 导入进度状态
 */
export enum ImportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * 导入进度DTO
 */
export class ImportProgressDto {
  @ApiProperty({ description: '任务ID' })
  taskId: string;

  @ApiProperty({ description: '导入状态', enum: ImportStatus })
  status: ImportStatus;

  @ApiProperty({ description: '总文件数' })
  totalFiles: number;

  @ApiProperty({ description: '已处理文件数' })
  processedFiles: number;

  @ApiProperty({ description: '成功导入数' })
  successCount: number;

  @ApiProperty({ description: '失败数' })
  failureCount: number;

  @ApiProperty({ description: '跳过数' })
  skippedCount: number;

  @ApiProperty({ description: '当前处理的文件名' })
  currentFile?: string;

  @ApiProperty({ description: '进度百分比 (0-100)' })
  progress: number;

  @ApiProperty({ description: '开始时间' })
  startTime: number;

  @ApiProperty({ description: '预计剩余时间（毫秒）' })
  estimatedTimeRemaining?: number;

  @ApiProperty({ description: '错误信息（失败时）' })
  error?: string;

  @ApiProperty({
    description: '详细结果（完成时）',
    type: [ArticleImportResultDto],
  })
  results?: ArticleImportResultDto[];
}

/**
 * 开始导入响应DTO
 */
export class StartImportResponseDto {
  @ApiProperty({ description: '任务ID' })
  taskId: string;

  @ApiProperty({ description: '导入状态', enum: ImportStatus })
  status: ImportStatus;

  @ApiProperty({ description: '总文件数' })
  totalFiles: number;

  @ApiProperty({ description: '消息' })
  message: string;
}
