import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import {
  BaseCreateDto,
  BaseUpdateDto,
  BaseQueryDto,
  BaseStatsDto,
} from './base/base.dto';
import {
  NUMERIC_LIMITS,
  VALIDATION_MESSAGES,
} from '@/common/constants/validation.constants';

export class CreateTagDto extends BaseCreateDto {
  @ApiPropertyOptional({
    description: '标签热度',
    minimum: NUMERIC_LIMITS.HEAT.MIN,
    maximum: NUMERIC_LIMITS.HEAT.MAX,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(NUMERIC_LIMITS.HEAT.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE('标签热度', NUMERIC_LIMITS.HEAT.MIN),
  })
  @Max(NUMERIC_LIMITS.HEAT.MAX, {
    message: VALIDATION_MESSAGES.MAX_VALUE('标签热度', NUMERIC_LIMITS.HEAT.MAX),
  })
  @Type(() => Number)
  heat?: number;
}

export class UpdateTagDto extends BaseUpdateDto {
  @ApiPropertyOptional({
    description: '标签热度',
    minimum: NUMERIC_LIMITS.HEAT.MIN,
    maximum: NUMERIC_LIMITS.HEAT.MAX,
  })
  @IsOptional()
  @IsInt()
  @Min(NUMERIC_LIMITS.HEAT.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE('标签热度', NUMERIC_LIMITS.HEAT.MIN),
  })
  @Max(NUMERIC_LIMITS.HEAT.MAX, {
    message: VALIDATION_MESSAGES.MAX_VALUE('标签热度', NUMERIC_LIMITS.HEAT.MAX),
  })
  @Type(() => Number)
  heat?: number;
}

export class TagQueryDto extends BaseQueryDto {
  @ApiPropertyOptional({
    description: '最小热度',
    minimum: NUMERIC_LIMITS.HEAT.MIN,
  })
  @IsOptional()
  @IsInt()
  @Min(NUMERIC_LIMITS.HEAT.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE('最小热度', NUMERIC_LIMITS.HEAT.MIN),
  })
  @Type(() => Number)
  minHeat?: number;

  @ApiPropertyOptional({
    description: '最大热度',
    maximum: NUMERIC_LIMITS.HEAT.MAX,
  })
  @IsOptional()
  @IsInt()
  @Max(NUMERIC_LIMITS.HEAT.MAX, {
    message: VALIDATION_MESSAGES.MAX_VALUE('最大热度', NUMERIC_LIMITS.HEAT.MAX),
  })
  @Type(() => Number)
  maxHeat?: number;

  @ApiPropertyOptional({
    description: '最小流行度',
    minimum: NUMERIC_LIMITS.HEAT.MIN,
  })
  @IsOptional()
  @IsInt()
  @Min(NUMERIC_LIMITS.HEAT.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE(
      '最小流行度',
      NUMERIC_LIMITS.HEAT.MIN,
    ),
  })
  @Type(() => Number)
  minPopularity?: number;

  @ApiPropertyOptional({
    description: '是否包含统计信息',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeStats?: boolean;
}

export class TagStatsDto extends BaseStatsDto {
  @ApiProperty({ description: '热度' })
  popularity: number;

  @ApiProperty({ description: '颜色' })
  color: string;
}

export class PopularTagsDto {
  @ApiPropertyOptional({
    description: '返回数量',
    minimum: NUMERIC_LIMITS.LIMIT.MIN,
    maximum: NUMERIC_LIMITS.LIMIT.MAX,
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(NUMERIC_LIMITS.LIMIT.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE(
      '返回数量',
      NUMERIC_LIMITS.LIMIT.MIN,
    ),
  })
  @Max(NUMERIC_LIMITS.LIMIT.MAX, {
    message: VALIDATION_MESSAGES.MAX_VALUE(
      '返回数量',
      NUMERIC_LIMITS.LIMIT.MAX,
    ),
  })
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: '时间范围（天）',
    minimum: NUMERIC_LIMITS.DAYS.MIN,
    maximum: NUMERIC_LIMITS.DAYS.MAX,
    default: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(NUMERIC_LIMITS.DAYS.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE('时间范围', NUMERIC_LIMITS.DAYS.MIN),
  })
  @Max(NUMERIC_LIMITS.DAYS.MAX, {
    message: VALIDATION_MESSAGES.MAX_VALUE('时间范围', NUMERIC_LIMITS.DAYS.MAX),
  })
  @Type(() => Number)
  days?: number = 30;
}
