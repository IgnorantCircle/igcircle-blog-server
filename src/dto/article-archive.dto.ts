import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsUUID, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationSortDto } from './pagination-sort.dto';

export class ArticleArchiveDto extends PaginationSortDto {
  @ApiPropertyOptional({
    description: '年份',
    example: 2024,
    minimum: 2000,
    maximum: 2100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '年份必须是整数' })
  @Min(2000, { message: '年份不能小于2000' })
  @Max(2100, { message: '年份不能大于2100' })
  year?: number;

  @ApiPropertyOptional({
    description: '月份',
    example: 12,
    minimum: 1,
    maximum: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '月份必须是整数' })
  @Min(1, { message: '月份不能小于1' })
  @Max(12, { message: '月份不能大于12' })
  month?: number;

  @ApiPropertyOptional({
    description: '分类ID',
    example: 'uuid-string',
  })
  @IsOptional()
  @IsUUID('4', { message: '分类ID必须是有效的UUID' })
  categoryId?: string;

  @ApiPropertyOptional({
    description: '标签ID',
    example: 'uuid-string',
  })
  @IsOptional()
  @IsUUID('4', { message: '标签ID必须是有效的UUID' })
  tagId?: string;
}
