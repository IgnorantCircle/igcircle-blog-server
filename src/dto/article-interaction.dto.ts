import { IsUUID, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { BaseQueryDto } from './base/base.dto';
import { VALIDATION_MESSAGES } from '@/common/constants/validation.constants';

/**
 * 文章点赞/收藏操作DTO
 */
export class ArticleInteractionDto {
  @ApiProperty({
    description: '文章ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.INVALID_UUID('文章ID'),
  })
  articleId: string;
}

/**
 * 文章点赞状态响应DTO
 */
export class ArticleLikeStatusDto {
  @ApiProperty({
    description: '文章ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  articleId: string;

  @ApiProperty({
    description: '是否已点赞',
    example: true,
  })
  isLiked: boolean;

  @ApiProperty({
    description: '点赞总数',
    example: 42,
  })
  likeCount: number;
}

/**
 * 文章收藏状态响应DTO
 */
export class ArticleFavoriteStatusDto {
  @ApiProperty({
    description: '文章ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  articleId: string;

  @ApiProperty({
    description: '是否已收藏',
    example: true,
  })
  isFavorited: boolean;

  @ApiProperty({
    description: '收藏总数',
    example: 15,
  })
  favoriteCount: number;
}

/**
 * 用户文章交互查询DTO
 */
export class UserArticleInteractionQueryDto extends BaseQueryDto {
  @ApiPropertyOptional({
    description: '是否包含点赞状态',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeLikeStatus?: boolean;

  @ApiPropertyOptional({
    description: '是否包含收藏状态',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeFavoriteStatus?: boolean;

  @ApiPropertyOptional({
    description: '分类ID过滤',
  })
  @IsOptional()
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.INVALID_UUID('分类ID'),
  })
  categoryId?: string;

  @ApiPropertyOptional({
    description: '标签ID过滤',
  })
  @IsOptional()
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.INVALID_UUID('标签ID'),
  })
  tagId?: string;
}

/**
 * 批量检查文章交互状态DTO
 */
export class BatchCheckArticleInteractionDto {
  @ApiProperty({
    description: '文章ID列表',
    type: [String],
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '456e7890-e12b-34d5-a678-901234567890',
    ],
  })
  @IsUUID('4', {
    each: true,
    message: VALIDATION_MESSAGES.INVALID_UUID('文章ID'),
  })
  articleIds: string[];
}

/**
 * 批量文章交互状态响应DTO
 */
export class BatchArticleInteractionStatusDto {
  @ApiProperty({
    description: '文章交互状态列表',
    type: [Object],
  })
  articles: Array<{
    articleId: string;
    isLiked: boolean;
    isFavorited: boolean;
    likeCount: number;
    favoriteCount: number;
  }>;
}
