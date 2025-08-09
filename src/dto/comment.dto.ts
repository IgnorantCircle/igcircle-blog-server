import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { BaseCreateDto, BaseUpdateDto, BaseQueryDto } from './base/base.dto';

import {
  VALIDATION_LIMITS,
  VALIDATION_MESSAGES,
} from '@/common/constants/validation.constants';

/**
 * 评论状态枚举
 */
export enum CommentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ACTIVE = 'active',
  HIDDEN = 'hidden',
  DELETED = 'deleted',
}

/**
 * 创建评论 DTO
 */
export class CreateCommentDto extends BaseCreateDto {
  @ApiProperty({
    description: '评论内容',
    maxLength: VALIDATION_LIMITS.COMMENT_CONTENT.MAX,
  })
  @IsString()
  @MaxLength(VALIDATION_LIMITS.COMMENT_CONTENT.MAX, {
    message: VALIDATION_MESSAGES.MAX_LENGTH(
      '评论内容',
      VALIDATION_LIMITS.COMMENT_CONTENT.MAX,
    ),
  })
  content: string;

  @ApiProperty({
    description: '文章ID',
  })
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.INVALID_UUID('文章ID'),
  })
  articleId: string;

  @ApiPropertyOptional({
    description: '父评论ID',
  })
  @IsOptional()
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.INVALID_UUID('父评论ID'),
  })
  parentId?: string;
}

/**
 * 更新评论 DTO
 */
export class UpdateCommentDto extends BaseUpdateDto {
  @ApiPropertyOptional({
    description: '评论内容',
    maxLength: VALIDATION_LIMITS.COMMENT_CONTENT.MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.COMMENT_CONTENT.MAX, {
    message: VALIDATION_MESSAGES.MAX_LENGTH(
      '评论内容',
      VALIDATION_LIMITS.COMMENT_CONTENT.MAX,
    ),
  })
  content?: string;
}

export class AdminUpdateCommentDto extends BaseUpdateDto {
  @ApiPropertyOptional({
    description: '评论内容',
    maxLength: VALIDATION_LIMITS.COMMENT_CONTENT.MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.COMMENT_CONTENT.MAX, {
    message: VALIDATION_MESSAGES.MAX_LENGTH(
      '评论内容',
      VALIDATION_LIMITS.COMMENT_CONTENT.MAX,
    ),
  })
  content?: string;

  @ApiPropertyOptional({
    description: '评论状态',
    enum: CommentStatus,
  })
  @IsOptional()
  @IsEnum(CommentStatus, {
    message: VALIDATION_MESSAGES.INVALID_ENUM('评论状态'),
  })
  status?: CommentStatus;

  @ApiPropertyOptional({
    description: '是否置顶',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isTop?: boolean;

  @ApiPropertyOptional({
    description: '管理员备注',
    maxLength: VALIDATION_LIMITS.ADMIN_NOTE.MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.ADMIN_NOTE.MAX, {
    message: VALIDATION_MESSAGES.MAX_LENGTH(
      '管理员备注',
      VALIDATION_LIMITS.ADMIN_NOTE.MAX,
    ),
  })
  adminNote?: string;
}

export class CommentQueryDto extends BaseQueryDto {
  @ApiPropertyOptional({
    description: '文章ID',
  })
  @IsOptional()
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.INVALID_UUID('文章ID'),
  })
  articleId?: string;

  @ApiPropertyOptional({
    description: '父评论ID',
  })
  @IsOptional()
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.INVALID_UUID('父评论ID'),
  })
  parentId?: string;

  @ApiPropertyOptional({
    description: '评论状态',
    enum: CommentStatus,
  })
  @IsOptional()
  @IsEnum(CommentStatus, {
    message: VALIDATION_MESSAGES.INVALID_ENUM('评论状态'),
  })
  status?: CommentStatus;

  @ApiPropertyOptional({
    description: '是否置顶',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isTop?: boolean;

  @ApiPropertyOptional({
    description: '用户ID',
  })
  @IsOptional()
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.INVALID_UUID('用户ID'),
  })
  userId?: string;

  @ApiPropertyOptional({
    description: '作者ID',
  })
  @IsOptional()
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.INVALID_UUID('作者ID'),
  })
  authorId?: string;

  @ApiPropertyOptional({
    description: '是否只显示顶级评论',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  topLevelOnly?: boolean;
}

/**
 * 评论点赞 DTO
 */
export class CommentLikeDto {
  @ApiProperty({
    description: '评论ID',
  })
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.INVALID_UUID('评论ID'),
  })
  commentId: string;
}
