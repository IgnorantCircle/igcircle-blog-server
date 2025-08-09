import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class PublishArticleDto {
  @ApiPropertyOptional({
    description: '发布时间',
  })
  @IsOptional()
  @Type(() => Date)
  publishedAt?: Date;

  @ApiPropertyOptional({ description: '是否置顶', default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isTop?: boolean;

  @ApiPropertyOptional({ description: '是否推荐', default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description: '权重（用于排序）',
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  weight?: number;
}
