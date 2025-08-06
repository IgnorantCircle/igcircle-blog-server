import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class PublishArticleDto {
  @ApiPropertyOptional({
    description: '发布时间（时间戳）',
  })
  @IsOptional()
  @Type(() => Number)
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
