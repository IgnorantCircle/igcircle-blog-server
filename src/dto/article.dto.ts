import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsUUID,
  IsInt,
  IsNumber,
  IsDateString,
  MinLength,
  MaxLength,
  IsEnum,
  Min,
  Max,
  ArrayMaxSize,
  ArrayNotEmpty,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { BaseCreateDto, BaseQueryDto } from './base/base.dto';
import {
  VALIDATION_LIMITS,
  ARRAY_LIMITS,
  NUMBER_LIMITS,
  VALIDATION_MESSAGES,
} from '@/common/constants/validation.constants';

/**
 * 文章状态枚举
 */
export enum ArticleStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}
/**
 * 创建文章DTO
 */
export class CreateArticleDto extends BaseCreateDto {
  @ApiProperty({
    description: '文章标题',
    minLength: VALIDATION_LIMITS.ARTICLE_TITLE.MIN,
    maxLength: VALIDATION_LIMITS.ARTICLE_TITLE.MAX,
  })
  @IsString()
  @MinLength(VALIDATION_LIMITS.ARTICLE_TITLE.MIN, {
    message: VALIDATION_MESSAGES.MIN_LENGTH(
      '文章标题',
      VALIDATION_LIMITS.ARTICLE_TITLE.MIN,
    ),
  })
  @MaxLength(VALIDATION_LIMITS.ARTICLE_TITLE.MAX, {
    message: VALIDATION_MESSAGES.MAX_LENGTH(
      '文章标题',
      VALIDATION_LIMITS.ARTICLE_TITLE.MAX,
    ),
  })
  title: string;

  @ApiPropertyOptional({
    description: '文章摘要',
    maxLength: VALIDATION_LIMITS.ARTICLE_SUMMARY.MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.ARTICLE_SUMMARY.MAX, {
    message: VALIDATION_MESSAGES.MAX_LENGTH(
      '文章摘要',
      VALIDATION_LIMITS.ARTICLE_SUMMARY.MAX,
    ),
  })
  summary?: string;

  @ApiPropertyOptional({ description: '文章内容' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: '文章状态',
    enum: ['draft', 'published', 'archived'],
  })
  @IsOptional()
  @IsEnum(['draft', 'published', 'archived'], {
    message: VALIDATION_MESSAGES.INVALID_ENUM('文章状态'),
  })
  status?: string;

  @ApiPropertyOptional({ description: '封面图片URL' })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ description: '分类ID' })
  @IsOptional()
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.INVALID_UUID('分类ID'),
  })
  categoryId?: string;

  @ApiPropertyOptional({ description: '分类ID数组', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', {
    each: true,
    message: VALIDATION_MESSAGES.INVALID_UUID('分类ID'),
  })
  @ArrayMaxSize(ARRAY_LIMITS.CATEGORIES.MAX, {
    message: VALIDATION_MESSAGES.ARRAY_MAX_SIZE(
      '分类',
      ARRAY_LIMITS.CATEGORIES.MAX,
    ),
  })
  categoryIds?: string[];

  @ApiPropertyOptional({ description: '是否可见' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isVisible?: boolean;

  @ApiPropertyOptional({
    description: 'SEO标题',
    maxLength: VALIDATION_LIMITS.SEO_TITLE.MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.SEO_TITLE.MAX, {
    message: VALIDATION_MESSAGES.MAX_LENGTH(
      'SEO标题',
      VALIDATION_LIMITS.SEO_TITLE.MAX,
    ),
  })
  seoTitle?: string;

  @ApiPropertyOptional({
    description: 'SEO描述',
    maxLength: VALIDATION_LIMITS.SEO_DESCRIPTION.MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.SEO_DESCRIPTION.MAX, {
    message: VALIDATION_MESSAGES.MAX_LENGTH(
      'SEO描述',
      VALIDATION_LIMITS.SEO_DESCRIPTION.MAX,
    ),
  })
  seoDescription?: string;

  @ApiPropertyOptional({
    description: 'SEO关键词',
    maxLength: VALIDATION_LIMITS.SEO_KEYWORDS.MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.SEO_KEYWORDS.MAX, {
    message: VALIDATION_MESSAGES.MAX_LENGTH(
      'SEO关键词',
      VALIDATION_LIMITS.SEO_KEYWORDS.MAX,
    ),
  })
  seoKeywords?: string;

  @ApiPropertyOptional({ description: '是否允许评论', default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  allowComment?: boolean;

  @ApiPropertyOptional({ description: '是否允许评论', default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  allowComments?: boolean;

  @ApiPropertyOptional({ description: '是否置顶', default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isTop?: boolean;

  @ApiPropertyOptional({ description: '是否精选', default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description: '预计阅读时间（分钟）',
    minimum: NUMBER_LIMITS.READING_TIME.MIN,
    maximum: NUMBER_LIMITS.READING_TIME.MAX,
  })
  @IsOptional()
  @IsNumber({}, { message: VALIDATION_MESSAGES.INVALID_NUMBER('阅读时间') })
  @Min(NUMBER_LIMITS.READING_TIME.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE(
      '阅读时间',
      NUMBER_LIMITS.READING_TIME.MIN,
    ),
  })
  @Max(NUMBER_LIMITS.READING_TIME.MAX, {
    message: VALIDATION_MESSAGES.MAX_VALUE(
      '阅读时间',
      NUMBER_LIMITS.READING_TIME.MAX,
    ),
  })
  @Type(() => Number)
  readingTime?: number;

  @ApiPropertyOptional({ description: '发布时间' })
  @IsOptional()
  @IsDateString(
    {},
    {
      message: VALIDATION_MESSAGES.INVALID_DATE,
    },
  )
  publishedAt?: string;

  @ApiPropertyOptional({
    description: '自定义字段',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;

  @ApiPropertyOptional({ description: '标签ID数组', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', {
    each: true,
    message: VALIDATION_MESSAGES.INVALID_UUID('标签ID'),
  })
  @ArrayMaxSize(ARRAY_LIMITS.TAGS.MAX, {
    message: VALIDATION_MESSAGES.ARRAY_MAX_SIZE('标签', ARRAY_LIMITS.TAGS.MAX),
  })
  tagIds?: string[];
}

/**
 * 更新文章DTO
 */
export class UpdateArticleDto extends PartialType(CreateArticleDto) {}

/**
 * 搜索模式枚举
 */
export enum ArticleSearchMode {
  TITLE = 'title',
  SUMMARY = 'summary',
  CONTENT = 'content',
}

export class ArticleQueryDto extends BaseQueryDto {
  @ApiPropertyOptional({
    description: '搜索模式',
    enum: ArticleSearchMode,
    example: ArticleSearchMode.TITLE,
  })
  @IsOptional()
  @IsEnum(ArticleSearchMode, {
    message: VALIDATION_MESSAGES.INVALID_ENUM('搜索模式'),
  })
  searchMode?: ArticleSearchMode;
  @ApiPropertyOptional({
    description: '标签ID列表',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', {
    each: true,
    message: VALIDATION_MESSAGES.INVALID_UUID('标签ID'),
  })
  @ArrayMaxSize(ARRAY_LIMITS.TAGS.MAX, {
    message: VALIDATION_MESSAGES.ARRAY_MAX_SIZE('标签', ARRAY_LIMITS.TAGS.MAX),
  })
  tagIds?: string[];

  @ApiPropertyOptional({
    description: '分类ID',
  })
  @IsOptional()
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.INVALID_UUID('分类ID'),
  })
  categoryId?: string;

  @ApiPropertyOptional({ description: '分类ID数组', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', {
    each: true,
    message: VALIDATION_MESSAGES.INVALID_UUID('分类ID'),
  })
  @ArrayMaxSize(ARRAY_LIMITS.CATEGORIES.MAX, {
    message: VALIDATION_MESSAGES.ARRAY_MAX_SIZE(
      '分类',
      ARRAY_LIMITS.CATEGORIES.MAX,
    ),
  })
  categoryIds?: string[];
  @ApiPropertyOptional({
    description: '文章状态',
    enum: ArticleStatus,
    example: ArticleStatus.PUBLISHED,
  })
  @IsOptional()
  @IsEnum(ArticleStatus, {
    message: VALIDATION_MESSAGES.INVALID_ENUM('文章状态'),
  })
  status?: ArticleStatus;

  @ApiPropertyOptional({ description: '是否可见' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isVisible?: boolean;

  @ApiPropertyOptional({
    description: '是否精选',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: VALIDATION_MESSAGES.INVALID_BOOLEAN('是否精选') })
  @Type(() => Boolean)
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description: '是否置顶',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: VALIDATION_MESSAGES.INVALID_BOOLEAN('是否置顶') })
  @Type(() => Boolean)
  isTop?: boolean;

  @ApiPropertyOptional({
    description: '最小阅读时间（分钟）',
    minimum: NUMBER_LIMITS.READING_TIME.MIN,
    example: 5,
  })
  @IsOptional()
  @IsNumber({}, { message: VALIDATION_MESSAGES.INVALID_NUMBER('最小阅读时间') })
  @Min(NUMBER_LIMITS.READING_TIME.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE(
      '最小阅读时间',
      NUMBER_LIMITS.READING_TIME.MIN,
    ),
  })
  @Type(() => Number)
  minReadingTime?: number;

  @ApiPropertyOptional({
    description: '最大阅读时间（分钟）',
    maximum: NUMBER_LIMITS.READING_TIME.MAX,
    example: 30,
  })
  @IsOptional()
  @IsNumber({}, { message: VALIDATION_MESSAGES.INVALID_NUMBER('最大阅读时间') })
  @Max(NUMBER_LIMITS.READING_TIME.MAX, {
    message: VALIDATION_MESSAGES.MAX_VALUE(
      '最大阅读时间',
      NUMBER_LIMITS.READING_TIME.MAX,
    ),
  })
  @Type(() => Number)
  maxReadingTime?: number;

  @ApiPropertyOptional({
    description: '年份（用于归档查询）',
    minimum: NUMBER_LIMITS.YEAR.MIN,
    maximum: NUMBER_LIMITS.YEAR.MAX,
    example: 2023,
  })
  @IsOptional()
  @IsNumber({}, { message: VALIDATION_MESSAGES.INVALID_NUMBER('年份') })
  @Min(NUMBER_LIMITS.YEAR.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE('年份', NUMBER_LIMITS.YEAR.MIN),
  })
  @Max(NUMBER_LIMITS.YEAR.MAX, {
    message: VALIDATION_MESSAGES.MAX_VALUE('年份', NUMBER_LIMITS.YEAR.MAX),
  })
  @Type(() => Number)
  year?: number;

  @ApiPropertyOptional({
    description: '月份（用于归档查询）',
    minimum: NUMBER_LIMITS.MONTH.MIN,
    maximum: NUMBER_LIMITS.MONTH.MAX,
    example: 6,
  })
  @IsOptional()
  @IsNumber({}, { message: VALIDATION_MESSAGES.INVALID_NUMBER('月份') })
  @Min(NUMBER_LIMITS.MONTH.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE('月份', NUMBER_LIMITS.MONTH.MIN),
  })
  @Max(NUMBER_LIMITS.MONTH.MAX, {
    message: VALIDATION_MESSAGES.MAX_VALUE('月份', NUMBER_LIMITS.MONTH.MAX),
  })
  @Type(() => Number)
  month?: number;

  @ApiPropertyOptional({
    description: '发布开始日期（用于日期区间搜索）',
    example: '2023-01-01',
  })
  @IsOptional()
  @IsDateString(
    {},
    {
      message: VALIDATION_MESSAGES.INVALID_DATE,
    },
  )
  publishedAtStart?: string;

  @ApiPropertyOptional({
    description: '发布结束日期（用于日期区间搜索）',
    example: '2023-12-31',
  })
  @IsOptional()
  @IsDateString(
    {},
    {
      message: VALIDATION_MESSAGES.INVALID_DATE,
    },
  )
  publishedAtEnd?: string;
}

/**
 * 文章搜索DTO - 支持三种独立搜索模式
 */
export class ArticleSearchDto extends BaseQueryDto {
  @ApiPropertyOptional({
    description: '搜索模式',
    enum: ArticleSearchMode,
    example: ArticleSearchMode.TITLE,
  })
  @IsOptional()
  @IsEnum(ArticleSearchMode, {
    message: VALIDATION_MESSAGES.INVALID_ENUM('搜索模式'),
  })
  searchMode?: ArticleSearchMode;

  @ApiPropertyOptional({
    description: '标签ID列表',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', {
    each: true,
    message: VALIDATION_MESSAGES.INVALID_UUID('标签ID'),
  })
  @ArrayMaxSize(ARRAY_LIMITS.TAGS.MAX, {
    message: VALIDATION_MESSAGES.ARRAY_MAX_SIZE('标签', ARRAY_LIMITS.TAGS.MAX),
  })
  tagIds?: string[];

  @ApiPropertyOptional({
    description: '分类ID',
  })
  @IsOptional()
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.INVALID_UUID('分类ID'),
  })
  categoryId?: string;

  @ApiPropertyOptional({
    description: '文章状态',
    enum: ArticleStatus,
    default: ArticleStatus.PUBLISHED,
  })
  @IsOptional()
  @IsEnum(ArticleStatus, {
    message: VALIDATION_MESSAGES.INVALID_ENUM('文章状态'),
  })
  status?: ArticleStatus = ArticleStatus.PUBLISHED;
}

export class ArticleArchiveDto extends BaseQueryDto {
  @ApiPropertyOptional({
    description: '年份',
    minimum: NUMBER_LIMITS.YEAR.MIN,
    maximum: NUMBER_LIMITS.YEAR.MAX,
  })
  @IsOptional()
  @IsInt()
  @Min(NUMBER_LIMITS.YEAR.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE('年份', NUMBER_LIMITS.YEAR.MIN),
  })
  @Max(NUMBER_LIMITS.YEAR.MAX, {
    message: VALIDATION_MESSAGES.MAX_VALUE('年份', NUMBER_LIMITS.YEAR.MAX),
  })
  @Type(() => Number)
  year?: number;

  @ApiPropertyOptional({
    description: '月份',
    minimum: NUMBER_LIMITS.MONTH.MIN,
    maximum: NUMBER_LIMITS.MONTH.MAX,
  })
  @IsOptional()
  @IsInt()
  @Min(NUMBER_LIMITS.MONTH.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE('月份', NUMBER_LIMITS.MONTH.MIN),
  })
  @Max(NUMBER_LIMITS.MONTH.MAX, {
    message: VALIDATION_MESSAGES.MAX_VALUE('月份', NUMBER_LIMITS.MONTH.MAX),
  })
  @Type(() => Number)
  month?: number;

  @ApiPropertyOptional({ description: '是否包含统计信息', default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeStats?: boolean;
}

/**
 * 批量操作DTO
 */
export class BatchArticleOperationDto {
  @ApiProperty({
    description: '文章ID列表',
    type: [String],
    example: ['uuid1', 'uuid2', 'uuid3'],
  })
  @IsArray({
    message: '文章ID列表必须是数组',
  })
  @ArrayNotEmpty({
    message: '文章ID列表不能为空',
  })
  @IsUUID('4', {
    each: true,
    message: VALIDATION_MESSAGES.INVALID_UUID('文章ID'),
  })
  @ArrayMaxSize(50, {
    message: VALIDATION_MESSAGES.ARRAY_MAX_SIZE('文章ID', 50),
  })
  ids: string[];
}

/**
 * 批量发布文章DTO
 */
export class BatchPublishArticleDto {
  @ApiProperty({
    description: '文章ID列表',
    type: [String],
    example: ['uuid1', 'uuid2', 'uuid3'],
  })
  @IsArray({
    message: '文章ID列表必须是数组',
  })
  @ArrayNotEmpty({
    message: '文章ID列表不能为空',
  })
  @IsUUID('4', {
    each: true,
    message: VALIDATION_MESSAGES.INVALID_UUID('文章ID'),
  })
  @ArrayMaxSize(50, {
    message: VALIDATION_MESSAGES.ARRAY_MAX_SIZE('文章ID', 50),
  })
  ids: string[];

  @ApiPropertyOptional({
    description: '发布时间',
    example: '2023-12-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString(
    {},
    {
      message: VALIDATION_MESSAGES.INVALID_DATE,
    },
  )
  publishedAt?: string;
}

/**
 * 批量更新文章DTO
 */
export class BatchUpdateArticleDto extends BatchArticleOperationDto {
  @ApiPropertyOptional({
    description: '分类ID',
  })
  @IsOptional()
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.INVALID_UUID('分类ID'),
  })
  categoryId?: string;

  @ApiPropertyOptional({
    description: '标签ID列表',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', {
    each: true,
    message: VALIDATION_MESSAGES.INVALID_UUID('标签ID'),
  })
  @ArrayMaxSize(ARRAY_LIMITS.TAGS.MAX, {
    message: VALIDATION_MESSAGES.ARRAY_MAX_SIZE('标签', ARRAY_LIMITS.TAGS.MAX),
  })
  tagIds?: string[];

  @ApiPropertyOptional({
    description: '文章状态',
    enum: ArticleStatus,
  })
  @IsOptional()
  @IsEnum(ArticleStatus, {
    message: VALIDATION_MESSAGES.INVALID_ENUM('文章状态'),
  })
  status?: ArticleStatus;

  @ApiPropertyOptional({ description: '是否精选' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: '是否置顶' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isTop?: boolean;

  @ApiPropertyOptional({ description: '是否可见' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isVisible?: boolean;
}

/**
 * 批量导出文章DTO
 */
export class BatchExportArticleDto {
  @ApiPropertyOptional({
    description: '文章ID列表（如果不提供则导出所有符合条件的文章）',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', {
    each: true,
    message: VALIDATION_MESSAGES.INVALID_UUID('文章ID'),
  })
  @ArrayMaxSize(100, {
    message: VALIDATION_MESSAGES.ARRAY_MAX_SIZE('文章ID', 100),
  })
  ids?: string[];

  @ApiPropertyOptional({
    description: '导出格式',
    enum: ['json', 'csv', 'markdown'],
    default: 'json',
  })
  @IsOptional()
  @IsEnum(['json', 'csv', 'markdown'], {
    message: VALIDATION_MESSAGES.INVALID_ENUM('导出格式'),
  })
  format?: 'json' | 'csv' | 'markdown';

  @ApiPropertyOptional({
    description: '文章状态过滤',
    enum: ArticleStatus,
  })
  @IsOptional()
  @IsEnum(ArticleStatus, {
    message: VALIDATION_MESSAGES.INVALID_ENUM('文章状态'),
  })
  status?: ArticleStatus;

  @ApiPropertyOptional({
    description: '分类ID过滤',
  })
  @IsOptional()
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.INVALID_UUID('分类ID'),
  })
  categoryId?: string;

  @ApiPropertyOptional({
    description: '标签ID列表过滤',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', {
    each: true,
    message: VALIDATION_MESSAGES.INVALID_UUID('标签ID'),
  })
  tagIds?: string[];

  @ApiPropertyOptional({
    description: '是否包含内容',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeContent?: boolean;

  @ApiPropertyOptional({
    description: '是否包含标签信息',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeTags?: boolean;

  @ApiPropertyOptional({
    description: '是否包含分类信息',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeCategory?: boolean;
}
