import {
  IsUUID,
  Min,
  IsOptional,
  IsBoolean,
  IsString,
  IsNumber,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  BaseCreateDto,
  BaseUpdateDto,
  BaseQueryDto,
  BaseStatsDto,
} from './base/base.dto';
import {
  VALIDATION_MESSAGES,
  NUMBER_LIMITS,
} from '@/common/constants/validation.constants';

export class CreateCategoryDto extends BaseCreateDto {
  @ApiPropertyOptional({ description: '分类图标' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: '父分类ID' })
  @IsOptional()
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.INVALID_UUID('父分类ID'),
  })
  parentId?: string;

  @ApiPropertyOptional({
    description: '排序权重',
    minimum: NUMBER_LIMITS.WEIGHT.MIN,
    maximum: NUMBER_LIMITS.WEIGHT.MAX,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    {},
    {
      message: VALIDATION_MESSAGES.INVALID_NUMBER('排序权重'),
    },
  )
  @Min(NUMBER_LIMITS.WEIGHT.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE(
      '排序权重',
      NUMBER_LIMITS.WEIGHT.MIN,
    ),
  })
  @Max(NUMBER_LIMITS.WEIGHT.MAX, {
    message: VALIDATION_MESSAGES.MAX_VALUE(
      '排序权重',
      NUMBER_LIMITS.WEIGHT.MAX,
    ),
  })
  sortOrder?: number;
}

export class UpdateCategoryDto extends BaseUpdateDto {
  @ApiPropertyOptional({ description: '分类图标' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: '父分类ID' })
  @IsOptional()
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.INVALID_UUID('父分类ID'),
  })
  parentId?: string;

  @ApiPropertyOptional({
    description: '排序权重',
    minimum: NUMBER_LIMITS.WEIGHT.MIN,
    maximum: NUMBER_LIMITS.WEIGHT.MAX,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    {},
    {
      message: VALIDATION_MESSAGES.INVALID_NUMBER('排序权重'),
    },
  )
  @Min(NUMBER_LIMITS.WEIGHT.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE(
      '排序权重',
      NUMBER_LIMITS.WEIGHT.MIN,
    ),
  })
  @Max(NUMBER_LIMITS.WEIGHT.MAX, {
    message: VALIDATION_MESSAGES.MAX_VALUE(
      '排序权重',
      NUMBER_LIMITS.WEIGHT.MAX,
    ),
  })
  sortOrder?: number;
}

export class CategoryQueryDto extends BaseQueryDto {
  @ApiPropertyOptional({ description: '父分类ID' })
  @IsOptional()
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.INVALID_UUID('父分类ID'),
  })
  parentId?: string;

  @ApiPropertyOptional({ description: '是否包含子分类', default: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeChildren?: boolean;
}

export class CategoryStatsDto extends BaseStatsDto {
  @ApiProperty({ description: '子分类数量' })
  childrenCount: number;
}
