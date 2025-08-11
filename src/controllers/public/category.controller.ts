import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseInterceptors,
} from '@nestjs/common';
import { NotFoundException } from '@/common/exceptions/business.exception';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CategoryService } from '@/services/category.service';
import { Public } from '@/decorators/public.decorator';
import { UnifiedCategoryDto } from '@/dto/base/unified-response.dto';
import { ErrorCode } from '@/common/constants/error-codes';
import {
  FieldVisibilityInterceptor,
  UsePublicVisibility,
} from '@/common/interceptors/field-visibility.interceptor';

@ApiTags('公共API - 分类')
@Controller('categories')
@Public()
@UseInterceptors(FieldVisibilityInterceptor)
export class PublicCategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @UsePublicVisibility()
  @ApiOperation({ summary: '获取所有可见分类' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: [UnifiedCategoryDto],
  })
  async findAll(): Promise<any> {
    // 使用带缓存的 findAll 方法
    const categories = await this.categoryService.findAll();

    // 只返回激活的分类
    return categories.filter((category) => category.isActive);
  }

  @Get(':id')
  @UsePublicVisibility()
  @ApiOperation({ summary: '根据ID获取分类详情' })
  @ApiParam({ name: 'id', description: '分类ID' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: UnifiedCategoryDto,
  })
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<any> {
    const category = await this.categoryService.findById(id);
    if (!category) {
      throw new NotFoundException(ErrorCode.CATEGORY_NOT_FOUND);
    }
    if (!category.isActive) {
      throw new NotFoundException(ErrorCode.CATEGORY_NOT_FOUND);
    }

    return category;
  }
}
