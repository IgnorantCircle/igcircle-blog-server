import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsUUID,
  IsInt,
  IsUrl,
  MinLength,
  MaxLength,
  IsEnum,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { PaginationSortDto } from '@/common/dto/pagination.dto';

export class CreateArticleDto {
  @ApiProperty({ description: '文章标题', minLength: 1, maxLength: 200 })
  @IsString()
  @MinLength(1, { message: '标题不能为空' })
  @MaxLength(200, { message: '标题最多200个字符' })
  title: string;

  @ApiPropertyOptional({ description: '文章摘要', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '摘要最多500个字符' })
  summary?: string;

  @ApiProperty({ description: '文章内容', minLength: 1 })
  @IsString()
  @MinLength(1, { message: '内容不能为空' })
  content: string;

  @ApiPropertyOptional({ description: '文章slug', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'slug不能超过200个字符' })
  slug?: string;

  @ApiPropertyOptional({
    description: '文章状态',
    enum: ['draft', 'published', 'archived'],
  })
  @IsOptional()
  @IsEnum(['draft', 'published', 'archived'], {
    message: '状态只能是draft、published或archived',
  })
  status?: string;

  @ApiPropertyOptional({ description: '封面图片URL' })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ description: '标签ID列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @ApiPropertyOptional({ description: '分类ID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'SEO描述', maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160, { message: 'SEO描述最多160个字符' })
  metaDescription?: string;

  @ApiPropertyOptional({ description: 'SEO关键词', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metaKeywords?: string[];

  @ApiPropertyOptional({ description: '社交媒体分享图片URL' })
  @IsOptional()
  @IsUrl({}, { message: '社交图片必须是有效的URL' })
  socialImage?: string;

  @ApiPropertyOptional({ description: '是否为精选文章', default: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: '是否置顶', default: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isTop?: boolean;

  @ApiPropertyOptional({ description: '权重', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  @Type(() => Number)
  weight?: number;

  @ApiPropertyOptional({ description: '是否允许评论', default: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  allowComment?: boolean;
}

export class UpdateArticleDto {
  @ApiPropertyOptional({
    description: '文章标题',
    minLength: 1,
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: '标题不能为空' })
  @MaxLength(200, { message: '标题最多200个字符' })
  title?: string;

  @ApiPropertyOptional({ description: '文章摘要', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '摘要最多500个字符' })
  summary?: string;

  @ApiPropertyOptional({ description: '文章slug', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'slug不能超过200个字符' })
  slug?: string;

  @ApiPropertyOptional({ description: '文章内容', minLength: 1 })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: '内容不能为空' })
  content?: string;

  @ApiPropertyOptional({ description: '封面图片URL' })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({
    description: '文章状态',
    enum: ['draft', 'published', 'archived'],
  })
  @IsOptional()
  @IsEnum(['draft', 'published', 'archived'], {
    message: '状态只能是draft、published或archived',
  })
  status?: string;

  @ApiPropertyOptional({ description: '标签ID列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @ApiPropertyOptional({ description: '分类ID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'SEO描述', maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160, { message: 'SEO描述最多160个字符' })
  metaDescription?: string;

  @ApiPropertyOptional({ description: 'SEO关键词', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metaKeywords?: string[];

  @ApiPropertyOptional({ description: '社交媒体分享图片URL' })
  @IsOptional()
  @IsUrl({}, { message: '社交图片必须是有效的URL' })
  socialImage?: string;

  @ApiPropertyOptional({ description: '是否为精选文章' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: '是否置顶' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isTop?: boolean;

  @ApiPropertyOptional({ description: '权重' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  @Type(() => Number)
  weight?: number;

  @ApiPropertyOptional({ description: '阅读时间（分钟）' })
  @IsOptional()
  @IsInt()
  @Min(1, { message: '阅读时间不能小于1分钟' })
  @Type(() => Number)
  readingTime?: number;

  @ApiPropertyOptional({ description: '是否允许评论' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  allowComment?: boolean;
}

export class ArticleQueryDto extends PaginationSortDto {
  @ApiPropertyOptional({
    description: '文章状态',
    enum: ['draft', 'published', 'archived'],
    example: 'published',
  })
  @IsOptional()
  @IsIn(['draft', 'published', 'archived'], {
    message: '状态只能是draft、published或archived',
  })
  status?: string;

  @ApiPropertyOptional({
    description: '分类ID',
    example: 'uuid-string',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: '标签ID',
    example: 'uuid-string',
  })
  @IsOptional()
  @IsUUID()
  tagId?: string;

  @ApiPropertyOptional({
    description: '关键词搜索',
    example: 'NestJS',
  })
  @IsOptional()
  @IsString({ message: '关键词必须是字符串' })
  keyword?: string;

  @ApiPropertyOptional({
    description: '是否精选',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: '是否精选必须是布尔值' })
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description: '是否置顶',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: '是否置顶必须是布尔值' })
  isTop?: boolean;

  @ApiPropertyOptional({
    description: '开始日期（时间戳）',
    example: 1704067200000,
  })
  @IsOptional()
  @IsInt({ message: '开始日期必须是时间戳' })
  @Type(() => Number)
  startDate?: number;

  @ApiPropertyOptional({
    description: '结束日期（时间戳）',
    example: 1735689599000,
  })
  @IsOptional()
  @IsInt({ message: '结束日期必须是时间戳' })
  @Type(() => Number)
  endDate?: number;

  @ApiPropertyOptional({
    description: '是否包含标签信息',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: '是否包含标签信息必须是布尔值' })
  includeTags?: boolean;

  @ApiPropertyOptional({
    description: '是否包含分类信息',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: '是否包含分类信息必须是布尔值' })
  includeCategory?: boolean;
}

export class ArticleSearchDto {
  @ApiProperty({ description: '搜索关键词' })
  @IsString()
  @MinLength(1, { message: '搜索关键词不能为空' })
  q: string;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description: '搜索范围',
    enum: ['title', 'content', 'all'],
    default: 'all',
  })
  @IsOptional()
  @IsEnum(['title', 'content', 'all'])
  scope?: string;

  @ApiPropertyOptional({ description: '分类ID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: '标签ID列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];
}

export class ArticleArchiveDto {
  @ApiPropertyOptional({ description: '年份' })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  @Type(() => Number)
  year?: number;

  @ApiPropertyOptional({ description: '月份' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month?: number;

  @ApiPropertyOptional({ description: '是否包含统计信息', default: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeStats?: boolean;
}
