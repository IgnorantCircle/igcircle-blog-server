import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsBoolean, IsNumber } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class PublishArticleDto {
  @ApiPropertyOptional({
    description: '发布时间（时间戳）',
    example: 1704067200000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: '发布时间必须是时间戳格式' })
  publishedAt?: number;

  @ApiPropertyOptional({
    description: '是否置顶',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: '是否置顶必须是布尔值' })
  isTop?: boolean;

  @ApiPropertyOptional({
    description: '是否精选',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: '是否精选必须是布尔值' })
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description: '权重（用于排序）',
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  weight?: number;
}
