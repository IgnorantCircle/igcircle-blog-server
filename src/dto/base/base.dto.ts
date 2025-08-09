import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsHexColor,
  MinLength,
  MaxLength,
} from 'class-validator';
import { PaginationSortDto } from './pagination.dto';
import {
  VALIDATION_LIMITS,
  VALIDATION_MESSAGES,
} from '@/common/constants/validation.constants';

/**
 * 基础创建DTO - 包含通用创建字段
 */
export abstract class BaseCreateDto {
  @ApiPropertyOptional({
    description: '名称',
    minLength: VALIDATION_LIMITS.NAME.MIN,
    maxLength: VALIDATION_LIMITS.NAME.MAX,
  })
  @IsOptional()
  @IsString()
  @MinLength(VALIDATION_LIMITS.NAME.MIN, {
    message: VALIDATION_MESSAGES.MIN_LENGTH('名称', VALIDATION_LIMITS.NAME.MIN),
  })
  @MaxLength(VALIDATION_LIMITS.NAME.MAX, {
    message: VALIDATION_MESSAGES.MAX_LENGTH('名称', VALIDATION_LIMITS.NAME.MAX),
  })
  name?: string;

  @ApiPropertyOptional({ description: 'slug' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '颜色', example: '#FF5733' })
  @IsOptional()
  @IsHexColor({ message: VALIDATION_MESSAGES.INVALID_HEX_COLOR })
  color?: string;

  @ApiPropertyOptional({ description: '是否激活', default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

/**
 * 基础更新DTO - 包含通用更新字段
 */
export abstract class BaseUpdateDto {
  @ApiPropertyOptional({
    description: '名称',
    minLength: VALIDATION_LIMITS.NAME.MIN,
    maxLength: VALIDATION_LIMITS.NAME.MAX,
  })
  @IsOptional()
  @IsString()
  @MinLength(VALIDATION_LIMITS.NAME.MIN, {
    message: VALIDATION_MESSAGES.MIN_LENGTH('名称', VALIDATION_LIMITS.NAME.MIN),
  })
  @MaxLength(VALIDATION_LIMITS.NAME.MAX, {
    message: VALIDATION_MESSAGES.MAX_LENGTH('名称', VALIDATION_LIMITS.NAME.MAX),
  })
  name?: string;

  @ApiPropertyOptional({ description: 'slug' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '颜色', example: '#FF5733' })
  @IsOptional()
  @IsHexColor({ message: VALIDATION_MESSAGES.INVALID_HEX_COLOR })
  color?: string;

  @ApiPropertyOptional({ description: '是否激活' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

/**
 * 基础查询DTO - 包含通用查询字段
 */
export abstract class BaseQueryDto extends PaginationSortDto {
  @ApiPropertyOptional({
    description: '关键词搜索',
    minLength: VALIDATION_LIMITS.SEARCH_KEYWORD.MIN,
    maxLength: VALIDATION_LIMITS.SEARCH_KEYWORD.MAX,
  })
  @IsOptional()
  @IsString()
  @MinLength(VALIDATION_LIMITS.SEARCH_KEYWORD.MIN, {
    message: VALIDATION_MESSAGES.MIN_LENGTH(
      '关键词搜索',
      VALIDATION_LIMITS.SEARCH_KEYWORD.MIN,
    ),
  })
  @MaxLength(VALIDATION_LIMITS.SEARCH_KEYWORD.MAX, {
    message: VALIDATION_MESSAGES.MAX_LENGTH(
      '关键词搜索',
      VALIDATION_LIMITS.SEARCH_KEYWORD.MAX,
    ),
  })
  keyword?: string;

  @ApiPropertyOptional({ description: '是否激活' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

/**
 * 基础统计DTO - 包含通用统计字段
 */
export abstract class BaseStatsDto {
  @ApiProperty({ description: 'ID' })
  id: string;

  @ApiProperty({ description: '名称' })
  name: string;

  @ApiProperty({ description: '文章数量' })
  articleCount: number;
}
