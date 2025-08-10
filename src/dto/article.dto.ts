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
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { BaseCreateDto, BaseQueryDto } from './base/base.dto';
import {
  VALIDATION_LIMITS,
  ARRAY_LIMITS,
  NUMERIC_LIMITS,
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
    minimum: NUMERIC_LIMITS.READING_TIME.MIN,
    maximum: NUMERIC_LIMITS.READING_TIME.MAX,
  })
  @IsOptional()
  @IsNumber({}, { message: VALIDATION_MESSAGES.INVALID_NUMBER('阅读时间') })
  @Min(NUMERIC_LIMITS.READING_TIME.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE(
      '阅读时间',
      NUMERIC_LIMITS.READING_TIME.MIN,
    ),
  })
  @Max(NUMERIC_LIMITS.READING_TIME.MAX, {
    message: VALIDATION_MESSAGES.MAX_VALUE(
      '阅读时间',
      NUMERIC_LIMITS.READING_TIME.MAX,
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

export class ArticleQueryDto extends BaseQueryDto {
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
    description: '作者ID',
    example: 'uuid-string',
  })
  @IsOptional()
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.INVALID_UUID('作者ID'),
  })
  authorId?: string;

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
    minimum: NUMERIC_LIMITS.READING_TIME.MIN,
    example: 5,
  })
  @IsOptional()
  @IsNumber({}, { message: VALIDATION_MESSAGES.INVALID_NUMBER('最小阅读时间') })
  @Min(NUMERIC_LIMITS.READING_TIME.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE(
      '最小阅读时间',
      NUMERIC_LIMITS.READING_TIME.MIN,
    ),
  })
  @Type(() => Number)
  minReadingTime?: number;

  @ApiPropertyOptional({
    description: '最大阅读时间（分钟）',
    maximum: NUMERIC_LIMITS.READING_TIME.MAX,
    example: 30,
  })
  @IsOptional()
  @IsNumber({}, { message: VALIDATION_MESSAGES.INVALID_NUMBER('最大阅读时间') })
  @Max(NUMERIC_LIMITS.READING_TIME.MAX, {
    message: VALIDATION_MESSAGES.MAX_VALUE(
      '最大阅读时间',
      NUMERIC_LIMITS.READING_TIME.MAX,
    ),
  })
  @Type(() => Number)
  maxReadingTime?: number;

  @ApiPropertyOptional({
    description: '年份（用于归档查询）',
    minimum: NUMERIC_LIMITS.YEAR.MIN,
    maximum: NUMERIC_LIMITS.YEAR.MAX,
    example: 2023,
  })
  @IsOptional()
  @IsNumber({}, { message: VALIDATION_MESSAGES.INVALID_NUMBER('年份') })
  @Min(NUMERIC_LIMITS.YEAR.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE('年份', NUMERIC_LIMITS.YEAR.MIN),
  })
  @Max(NUMERIC_LIMITS.YEAR.MAX, {
    message: VALIDATION_MESSAGES.MAX_VALUE('年份', NUMERIC_LIMITS.YEAR.MAX),
  })
  @Type(() => Number)
  year?: number;

  @ApiPropertyOptional({
    description: '月份（用于归档查询）',
    minimum: NUMERIC_LIMITS.MONTH.MIN,
    maximum: NUMERIC_LIMITS.MONTH.MAX,
    example: 6,
  })
  @IsOptional()
  @IsNumber({}, { message: VALIDATION_MESSAGES.INVALID_NUMBER('月份') })
  @Min(NUMERIC_LIMITS.MONTH.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE('月份', NUMERIC_LIMITS.MONTH.MIN),
  })
  @Max(NUMERIC_LIMITS.MONTH.MAX, {
    message: VALIDATION_MESSAGES.MAX_VALUE('月份', NUMERIC_LIMITS.MONTH.MAX),
  })
  @Type(() => Number)
  month?: number;

  @ApiPropertyOptional({
    description: '是否包含标签信息',
    example: true,
  })
  @IsOptional()
  @IsBoolean({
    message: VALIDATION_MESSAGES.INVALID_BOOLEAN('是否包含标签信息'),
  })
  @Type(() => Boolean)
  includeTags?: boolean;

  @ApiPropertyOptional({
    description: '是否包含分类信息',
    example: true,
  })
  @IsOptional()
  @IsBoolean({
    message: VALIDATION_MESSAGES.INVALID_BOOLEAN('是否包含分类信息'),
  })
  @Type(() => Boolean)
  includeCategory?: boolean;
}

export class ArticleSearchDto extends BaseQueryDto {
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
    minimum: NUMERIC_LIMITS.YEAR.MIN,
    maximum: NUMERIC_LIMITS.YEAR.MAX,
  })
  @IsOptional()
  @IsInt()
  @Min(NUMERIC_LIMITS.YEAR.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE('年份', NUMERIC_LIMITS.YEAR.MIN),
  })
  @Max(NUMERIC_LIMITS.YEAR.MAX, {
    message: VALIDATION_MESSAGES.MAX_VALUE('年份', NUMERIC_LIMITS.YEAR.MAX),
  })
  @Type(() => Number)
  year?: number;

  @ApiPropertyOptional({
    description: '月份',
    minimum: NUMERIC_LIMITS.MONTH.MIN,
    maximum: NUMERIC_LIMITS.MONTH.MAX,
  })
  @IsOptional()
  @IsInt()
  @Min(NUMERIC_LIMITS.MONTH.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE('月份', NUMERIC_LIMITS.MONTH.MIN),
  })
  @Max(NUMERIC_LIMITS.MONTH.MAX, {
    message: VALIDATION_MESSAGES.MAX_VALUE('月份', NUMERIC_LIMITS.MONTH.MAX),
  })
  @Type(() => Number)
  month?: number;

  @ApiPropertyOptional({ description: '是否包含统计信息', default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeStats?: boolean;
}
