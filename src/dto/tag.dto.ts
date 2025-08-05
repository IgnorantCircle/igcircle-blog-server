import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsHexColor,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { PaginationSortDto } from '@/common/dto/pagination.dto';

export class CreateTagDto {
  @ApiProperty({ description: '标签名称', minLength: 1, maxLength: 50 })
  @IsString()
  @MinLength(1, { message: '标签名称不能为空' })
  @MaxLength(50, { message: '标签名称最多50个字符' })
  name: string;

  @ApiPropertyOptional({ description: '标签slug', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'slug不能超过100个字符' })
  slug?: string;

  @ApiPropertyOptional({ description: '标签描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '标签颜色', example: '#FF5733' })
  @IsOptional()
  @IsHexColor({ message: '颜色必须是有效的十六进制颜色值' })
  color?: string;

  @ApiPropertyOptional({ description: '是否激活', default: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;
}

export class UpdateTagDto {
  @ApiPropertyOptional({ description: '标签名称', minLength: 1, maxLength: 50 })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: '标签名称不能为空' })
  @MaxLength(50, { message: '标签名称最多50个字符' })
  name?: string;

  @ApiPropertyOptional({ description: '标签slug', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'slug不能超过100个字符' })
  slug?: string;

  @ApiPropertyOptional({ description: '标签描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '标签颜色', example: '#FF5733' })
  @IsOptional()
  @IsHexColor({ message: '颜色必须是有效的十六进制颜色值' })
  color?: string;

  @ApiPropertyOptional({ description: '是否激活' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;
}

export class TagQueryDto extends PaginationSortDto {
  @ApiPropertyOptional({ description: '标签名称关键词' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '是否激活' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @ApiPropertyOptional({ description: '最小热度' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  minPopularity?: number;

  @ApiPropertyOptional({ description: '是否包含文章统计', default: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeStats?: boolean;
}

export class TagStatsDto {
  @ApiProperty({ description: '标签ID' })
  id: string;

  @ApiProperty({ description: '标签名称' })
  name: string;

  @ApiProperty({ description: '使用次数' })
  articleCount: number;

  @ApiProperty({ description: '热度' })
  popularity: number;

  @ApiProperty({ description: '颜色' })
  color: string;
}

export class PopularTagsDto {
  @ApiPropertyOptional({ description: '返回数量', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: '时间范围（天）', default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  days?: number;
}
