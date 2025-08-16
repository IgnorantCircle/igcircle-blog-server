import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  NUMBER_LIMITS,
  VALIDATION_MESSAGES,
} from '@/common/constants/validation.constants';

/**
 * 分页查询DTO
 */
export class PaginationDto {
  @ApiPropertyOptional({
    description: '页码',
    default: 1,
    minimum: NUMBER_LIMITS.PAGE.MIN,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(NUMBER_LIMITS.PAGE.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE('页码', NUMBER_LIMITS.PAGE.MIN),
  })
  page?: number = 1;

  @ApiPropertyOptional({
    description: '每页数量',
    default: 10,
    minimum: NUMBER_LIMITS.LIMIT.MIN,
    maximum: NUMBER_LIMITS.LIMIT.MAX,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(NUMBER_LIMITS.LIMIT.MIN, {
    message: VALIDATION_MESSAGES.MIN_VALUE('每页数量', NUMBER_LIMITS.LIMIT.MIN),
  })
  @Max(NUMBER_LIMITS.LIMIT.MAX, {
    message: VALIDATION_MESSAGES.MAX_VALUE('每页数量', NUMBER_LIMITS.LIMIT.MAX),
  })
  limit?: number = 10;
}

/**
 * 分页和排序DTO
 */
export class PaginationSortDto extends PaginationDto {
  @ApiPropertyOptional({
    description: '排序字段',
    default: 'createdAt',
    example: 'createdAt',
  })
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: '排序方向',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
    example: 'DESC',
  })
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
