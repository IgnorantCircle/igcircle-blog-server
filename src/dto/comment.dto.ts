import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationSortDto } from '@/common/dto/pagination.dto';

/**
 * 创建评论 DTO
 */
export class CreateCommentDto {
  @ApiProperty({
    description: '评论内容',
    minLength: 1,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;

  @ApiProperty({ description: '文章ID' })
  @IsUUID()
  @IsNotEmpty()
  articleId: string;

  @ApiPropertyOptional({ description: '父评论ID（用于回复）' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

/**
 * 更新评论 DTO
 */
export class UpdateCommentDto {
  @ApiProperty({
    description: '评论内容',
    minLength: 1,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;
}

export class AdminUpdateCommentDto {
  @ApiPropertyOptional({
    description: '评论内容',
    minLength: 1,
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  content?: string;

  @ApiPropertyOptional({
    description: '评论状态',
    enum: ['active', 'hidden', 'deleted'],
  })
  @IsOptional()
  @IsEnum(['active', 'hidden', 'deleted'])
  status?: string;

  @ApiPropertyOptional({ description: '是否置顶' })
  @IsOptional()
  @IsBoolean()
  isTop?: boolean;

  @ApiPropertyOptional({ description: '管理员备注', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '管理员备注最多500个字符' })
  adminNote?: string;
}

export class CommentQueryDto extends PaginationSortDto {
  @ApiPropertyOptional({ description: '文章ID' })
  @IsOptional()
  @IsUUID('4', { message: '文章ID格式不正确' })
  articleId?: string;

  @ApiPropertyOptional({ description: '用户ID' })
  @IsOptional()
  @IsUUID('4', { message: '用户ID格式不正确' })
  authorId?: string;

  @ApiPropertyOptional({
    description: '评论状态',
    enum: ['active', 'hidden', 'deleted'],
  })
  @IsOptional()
  @IsEnum(['active', 'hidden', 'deleted'])
  status?: string;

  @ApiPropertyOptional({ description: '父评论ID（查询回复时使用）' })
  @IsOptional()
  @IsUUID('4', { message: '父评论ID格式不正确' })
  parentId?: string;

  @ApiPropertyOptional({ description: '搜索关键词' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '是否只查询顶级评论' })
  @IsOptional()
  @IsBoolean()
  topLevelOnly?: boolean;
}

/**
 * 评论点赞 DTO
 */
export class CommentLikeDto {
  @ApiProperty({ description: '评论ID' })
  @IsUUID()
  @IsNotEmpty()
  commentId: string;
}
