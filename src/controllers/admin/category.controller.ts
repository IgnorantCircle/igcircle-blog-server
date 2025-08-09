import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { RolesGuard } from '@/guards/roles.guard';
import { Roles } from '@/decorators/roles.decorator';
import { Role } from '@/enums/role.enum';
import { CategoryService } from '@/services/category.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryQueryDto,
  CategoryStatsDto,
} from '@/dto/category.dto';
import { Category } from '@/entities/category.entity';
import { PaginatedResponse } from '@/common/interfaces/response.interface';
import {
  FieldVisibilityInterceptor,
  UseAdminVisibility,
} from '@/common/interceptors/field-visibility.interceptor';

@ApiTags('管理端API - 分类管理')
@Controller('admin/categories')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth('JWT-auth')
@UseInterceptors(FieldVisibilityInterceptor)
export class AdminCategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @UseAdminVisibility()
  @ApiOperation({ summary: '创建分类' })
  @ApiResponse({ status: 201, description: '分类创建成功' })
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
  ): Promise<Category> {
    const category = await this.categoryService.create(createCategoryDto);
    return category;
  }

  @Get()
  @UseAdminVisibility()
  @ApiOperation({ summary: '获取分类列表' })
  @ApiResponse({ status: 200, description: '获取成功', type: [Category] })
  async findAll(
    @Query() query: CategoryQueryDto,
  ): Promise<PaginatedResponse<Category>> {
    return await this.categoryService.findAllPaginated(query);
  }

  @Get('tree')
  @UseAdminVisibility()
  @ApiOperation({ summary: '获取分类树形结构' })
  @ApiResponse({ status: 200, description: '获取分类树形结构成功' })
  async getTree(): Promise<Category[]> {
    const tree = await this.categoryService.getTree();
    return tree;
  }

  @Get('stats')
  @UseAdminVisibility()
  @ApiOperation({ summary: '获取分类统计信息' })
  @ApiResponse({ status: 200, description: '获取分类统计信息成功' })
  async getStats(): Promise<CategoryStatsDto[]> {
    const stats = await this.categoryService.getStats();
    return stats;
  }

  @Get(':id')
  @UseAdminVisibility()
  @ApiOperation({ summary: '根据ID获取分类' })
  @ApiResponse({ status: 200, description: '获取分类成功' })
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<Category> {
    const category = await this.categoryService.findById(id);
    return category;
  }

  @Get('slug/:slug')
  @UseAdminVisibility()
  @ApiOperation({ summary: '根据slug获取分类' })
  @ApiResponse({ status: 200, description: '获取分类成功' })
  async findBySlug(@Param('slug') slug: string): Promise<Category> {
    const category = await this.categoryService.findBySlug(slug);
    return category;
  }

  @Patch(':id')
  @UseAdminVisibility()
  @ApiOperation({ summary: '更新分类' })
  @ApiResponse({ status: 200, description: '分类更新成功' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.categoryService.update(id, updateCategoryDto);
    return category;
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除分类' })
  @ApiResponse({ status: 200, description: '分类删除成功' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.categoryService.remove(id);
  }
}
