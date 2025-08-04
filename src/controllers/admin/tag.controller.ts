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
import { TagService } from '@/services/tag.service';
import {
  CreateTagDto,
  UpdateTagDto,
  TagQueryDto,
  TagStatsDto,
  PopularTagsDto,
} from '@/dto/tag.dto';
import { Tag } from '@/entities/tag.entity';
import { ResponseUtil } from '@/common/utils/response.util';
import {
  ApiResponse as ApiResponseInterface,
  PaginatedResponse,
} from '@/common/interfaces/response.interface';

@ApiTags('管理端API - 标签管理')
@Controller('admin/tags')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminTagController {
  constructor(private readonly tagService: TagService) {}

  @Post()
  @ApiOperation({ summary: '创建标签' })
  @ApiResponse({ status: 201, description: '标签创建成功' })
  async create(
    @Body() createTagDto: CreateTagDto,
  ): Promise<ApiResponseInterface<Tag>> {
    const tag = await this.tagService.create(createTagDto);
    return ResponseUtil.success(tag, '标签创建成功');
  }

  @Get()
  @ApiOperation({ summary: '获取标签列表' })
  @ApiResponse({ status: 200, description: '获取成功', type: [Tag] })
  async findAll(
    @Query() query: TagQueryDto,
  ): Promise<ApiResponseInterface<PaginatedResponse<Tag>>> {
    const result = await this.tagService.findAll(query);
    return ResponseUtil.paginated(
      result.items,
      result.total,
      result.page,
      result.limit,
      '获取标签列表成功',
    );
  }

  @Get('popular')
  @ApiOperation({ summary: '获取热门标签' })
  @ApiResponse({ status: 200, description: '获取成功', type: [Tag] })
  async getPopular(
    @Query() query: PopularTagsDto,
  ): Promise<ApiResponseInterface<Tag[]>> {
    const tags = await this.tagService.getPopular(query);
    return ResponseUtil.success(tags, '获取热门标签成功');
  }

  @Get('cloud')
  @ApiOperation({ summary: '获取标签云' })
  @ApiResponse({ status: 200, description: '获取标签云成功' })
  async getTagCloud(): Promise<ApiResponseInterface<any[]>> {
    const cloud = await this.tagService.getTagCloud();
    return ResponseUtil.success(cloud, '获取标签云成功');
  }

  @Get('stats')
  @ApiOperation({ summary: '获取标签统计信息' })
  @ApiResponse({ status: 200, description: '获取标签统计信息成功' })
  async getStats(): Promise<ApiResponseInterface<TagStatsDto[]>> {
    const stats = await this.tagService.getStats();
    return ResponseUtil.success(stats, '获取标签统计信息成功');
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID获取标签' })
  @ApiResponse({ status: 200, description: '获取标签成功' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseInterface<Tag>> {
    const tag = await this.tagService.findById(id);
    return ResponseUtil.success(tag, '获取标签成功');
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: '根据slug获取标签' })
  @ApiResponse({ status: 200, description: '获取标签成功' })
  async findBySlug(
    @Param('slug') slug: string,
  ): Promise<ApiResponseInterface<Tag>> {
    const tag = await this.tagService.findBySlug(slug);
    return ResponseUtil.success(tag, '获取标签成功');
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新标签' })
  @ApiResponse({ status: 200, description: '标签更新成功' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTagDto: UpdateTagDto,
  ): Promise<ApiResponseInterface<Tag>> {
    const tag = await this.tagService.update(id, updateTagDto);
    return ResponseUtil.success(tag, '标签更新成功');
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除标签' })
  @ApiResponse({ status: 200, description: '标签删除成功' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseInterface<null>> {
    await this.tagService.remove(id);
    return ResponseUtil.success(null, '标签删除成功');
  }
}
