import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { NotFoundException } from '@/common/exceptions/business.exception';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CategoryService } from '@/services/category.service';
import { Public } from '@/decorators/public.decorator';
import { PublicCategoryDto } from '@/dto/base/public.dto';
import { CategoryQueryDto } from '@/dto/category.dto';
import { plainToClass } from 'class-transformer';
import { ErrorCode } from '@/common/constants/error-codes';

@ApiTags('公共API - 分类')
@Controller('categories')
@Public()
@UseInterceptors(ClassSerializerInterceptor)
export class PublicCategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({ summary: '获取所有可见分类' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: [PublicCategoryDto],
  })
  async findAll() {
    const query = new CategoryQueryDto();
    query.page = 1;
    query.limit = 100;
    query.isActive = true;
    const result = await this.categoryService.findAll(query);

    return result.items.map((category) =>
      plainToClass(PublicCategoryDto, category, {
        excludeExtraneousValues: true,
      }),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID获取分类详情' })
  @ApiParam({ name: 'id', description: '分类ID' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: PublicCategoryDto,
  })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const category = await this.categoryService.findById(id);
    if (!category) {
      throw new NotFoundException(ErrorCode.CATEGORY_NOT_FOUND);
    }
    if (!category.isActive) {
      throw new NotFoundException(ErrorCode.CATEGORY_NOT_FOUND);
    }

    return plainToClass(PublicCategoryDto, category, {
      excludeExtraneousValues: true,
    });
  }
}
