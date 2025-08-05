import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationSortDto } from './pagination-sort.dto';

export class ArticleSearchDto extends PaginationSortDto {
  @ApiProperty({
    description: '搜索关键词',
    example: 'NestJS',
  })
  @IsString({ message: '搜索关键词必须是字符串' })
  keyword: string;

  @ApiPropertyOptional({
    description: '分类ID列表',
    type: [String],
    example: ['uuid1', 'uuid2'],
  })
  @IsOptional()
  @IsArray({ message: '分类ID必须是数组' })
  @IsUUID('4', { each: true, message: '分类ID必须是有效的UUID' })
  categoryIds?: string[];

  @ApiPropertyOptional({
    description: '标签ID列表',
    type: [String],
    example: ['uuid1', 'uuid2', 'uuid3'],
  })
  @IsOptional()
  @IsArray({ message: '标签ID必须是数组' })
  @IsUUID('4', { each: true, message: '标签ID必须是有效的UUID' })
  tagIds?: string[];

  @ApiPropertyOptional({
    description: '作者ID',
    example: 'uuid-string',
  })
  @IsOptional()
  @IsUUID('4', { message: '作者ID必须是有效的UUID' })
  authorId?: string;

  @ApiPropertyOptional({
    description: '最小阅读时间（分钟）',
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '最小阅读时间必须是整数' })
  @Min(1, { message: '最小阅读时间不能小于1分钟' })
  minReadingTime?: number;

  @ApiPropertyOptional({
    description: '最大阅读时间（分钟）',
    example: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '最大阅读时间必须是整数' })
  @Max(300, { message: '最大阅读时间不能超过300分钟' })
  maxReadingTime?: number;
}
