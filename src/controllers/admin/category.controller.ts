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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/guards/auth.guard';
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
import { ResponseUtil } from '@/common/utils/response.util';
import {
  ApiResponse as ApiResponseInterface,
  PaginatedResponse,
} from '@/common/interfaces/response.interface';

@ApiTags('管理端API - 分类管理')
@Controller('admin/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminCategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @ApiOperation({ summary: '创建分类' })
  @ApiResponse({ status: 201, description: '分类创建成功' })
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
  ): Promise<ApiResponseInterface<Category>> {
    const category = await this.categoryService.create(createCategoryDto);
    return ResponseUtil.success(category, '分类创建成功');
  }

  @Get()
  @ApiOperation({ summary: '获取分类列表' })
  @ApiResponse({ status: 200, description: '获取成功', type: [Category] })
  async findAll(
    @Query() query: CategoryQueryDto,
  ): Promise<ApiResponseInterface<PaginatedResponse<Category>>> {
    const result = await this.categoryService.findAll(query);
    return ResponseUtil.paginated(
      result.items,
      result.total,
      result.page,
      result.limit,
      '获取分类列表成功',
    );
  }

  @Get('tree')
  @ApiOperation({ summary: '获取分类树形结构' })
  @ApiResponse({ status: 200, description: '获取分类树形结构成功' })
  async getTree(): Promise<ApiResponseInterface<Category[]>> {
    const tree = await this.categoryService.getTree();
    return ResponseUtil.success(tree, '获取分类树形结构成功');
  }

  @Get('stats')
  @ApiOperation({ summary: '获取分类统计信息' })
  @ApiResponse({ status: 200, description: '获取分类统计信息成功' })
  async getStats(): Promise<ApiResponseInterface<CategoryStatsDto[]>> {
    const stats = await this.categoryService.getStats();
    return ResponseUtil.success(stats, '获取分类统计信息成功');
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID获取分类' })
  @ApiResponse({ status: 200, description: '获取分类成功' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseInterface<Category>> {
    const category = await this.categoryService.findById(id);
    return ResponseUtil.success(category, '获取分类成功');
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: '根据slug获取分类' })
  @ApiResponse({ status: 200, description: '获取分类成功' })
  async findBySlug(
    @Param('slug') slug: string,
  ): Promise<ApiResponseInterface<Category>> {
    const category = await this.categoryService.findBySlug(slug);
    return ResponseUtil.success(category, '获取分类成功');
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新分类' })
  @ApiResponse({ status: 200, description: '分类更新成功' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<ApiResponseInterface<Category>> {
    const category = await this.categoryService.update(id, updateCategoryDto);
    return ResponseUtil.success(category, '分类更新成功');
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除分类' })
  @ApiResponse({ status: 200, description: '分类删除成功' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseInterface<null>> {
    await this.categoryService.remove(id);
    return ResponseUtil.success(null, '分类删除成功');
  }
}
