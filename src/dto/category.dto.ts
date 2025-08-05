import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsHexColor,
  IsUUID,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { PaginationSortDto } from '@/common/dto/pagination.dto';

export class CreateCategoryDto {
  @ApiProperty({ description: '分类名称', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1, { message: '分类名称不能为空' })
  @MaxLength(100, { message: '分类名称最多100个字符' })
  name: string;

  @ApiPropertyOptional({ description: '分类slug', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'slug不能超过200个字符' })
  slug?: string;

  @ApiPropertyOptional({ description: '分类描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '封面图片URL' })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ description: '分类颜色', example: '#FF5733' })
  @IsOptional()
  @IsHexColor({ message: '颜色必须是有效的十六进制颜色值' })
  color?: string;

  @ApiPropertyOptional({ description: '排序权重', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional({ description: '父分类ID' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ description: '是否激活', default: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({
    description: '分类名称',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: '分类名称不能为空' })
  @MaxLength(100, { message: '分类名称最多100个字符' })
  name?: string;

  @ApiPropertyOptional({ description: '分类slug', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'slug不能超过200个字符' })
  slug?: string;

  @ApiPropertyOptional({ description: '分类描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '封面图片URL' })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ description: '分类颜色', example: '#FF5733' })
  @IsOptional()
  @IsHexColor({ message: '颜色必须是有效的十六进制颜色值' })
  color?: string;

  @ApiPropertyOptional({ description: '排序权重' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional({ description: '父分类ID' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ description: '是否激活' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;
}

export class CategoryQueryDto extends PaginationSortDto {
  @ApiPropertyOptional({ description: '分类名称关键词' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '是否激活' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @ApiPropertyOptional({ description: '父分类ID' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ description: '是否包含子分类', default: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeChildren?: boolean;
}

export class CategoryStatsDto {
  @ApiProperty({ description: '分类ID' })
  id: string;

  @ApiProperty({ description: '分类名称' })
  name: string;

  @ApiProperty({ description: '文章数量' })
  articleCount: number;

  @ApiProperty({ description: '子分类数量' })
  childrenCount: number;
}
