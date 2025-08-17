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
import { TagService } from '@/services/tag.service';
import {
  CreateTagDto,
  UpdateTagDto,
  TagQueryDto,
  TagStatsDto,
  PopularTagsDto,
} from '@/dto/tag.dto';
import { Tag } from '@/entities/tag.entity';
import {
  FieldVisibilityInterceptor,
  UseAdminVisibility,
} from '@/common/interceptors/field-visibility.interceptor';

@ApiTags('1.5 管理端API - 标签管理')
@Controller('admin/tags')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth('JWT-auth')
@UseInterceptors(FieldVisibilityInterceptor)
export class AdminTagController {
  constructor(private readonly tagService: TagService) {}

  @Post()
  @UseAdminVisibility()
  @ApiOperation({ summary: '创建标签' })
  @ApiResponse({ status: 201, description: '标签创建成功', type: Tag })
  async create(@Body() createTagDto: CreateTagDto): Promise<Tag> {
    const tag = await this.tagService.create(createTagDto);
    return tag;
  }

  @Get()
  @UseAdminVisibility()
  @ApiOperation({ summary: '获取标签列表' })
  @ApiResponse({ status: 200, description: '获取成功', type: [Tag] })
  async findAll(@Query() query: TagQueryDto): Promise<any> {
    return await this.tagService.findAllPaginated(query);
  }

  @Get('popular')
  @UseAdminVisibility()
  @ApiOperation({ summary: '获取热门标签' })
  @ApiResponse({ status: 200, description: '获取热门标签成功' })
  async getPopularTags(@Query() query: PopularTagsDto): Promise<Tag[]> {
    const tags = await this.tagService.getPopular(query);
    return tags;
  }

  @Get('cloud')
  @UseAdminVisibility()
  @ApiOperation({ summary: '获取标签云' })
  @ApiResponse({ status: 200, description: '获取标签云成功' })
  async getTagCloud(): Promise<any[]> {
    const cloud = await this.tagService.getTagCloud();
    return cloud;
  }

  @Get('stats')
  @UseAdminVisibility()
  @ApiOperation({ summary: '获取标签统计信息' })
  @ApiResponse({ status: 200, description: '获取标签统计信息成功' })
  async getStats(): Promise<TagStatsDto[]> {
    const stats = await this.tagService.getStats();
    return stats;
  }

  @Get(':id')
  @UseAdminVisibility()
  @ApiOperation({ summary: '根据ID获取标签' })
  @ApiResponse({ status: 200, description: '获取标签成功' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Tag> {
    const tag = await this.tagService.findById(id);
    return tag;
  }

  @Get('slug/:slug')
  @UseAdminVisibility()
  @ApiOperation({ summary: '根据slug获取标签' })
  @ApiResponse({ status: 200, description: '获取标签成功' })
  async findBySlug(@Param('slug') slug: string): Promise<Tag> {
    const tag = await this.tagService.findBySlug(slug);
    return tag;
  }

  @Patch(':id')
  @UseAdminVisibility()
  @ApiOperation({ summary: '更新标签' })
  @ApiResponse({ status: 200, description: '标签更新成功' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTagDto: UpdateTagDto,
  ): Promise<Tag> {
    const tag = await this.tagService.update(id, updateTagDto);
    return tag;
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除标签' })
  @ApiResponse({ status: 200, description: '标签删除成功' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.tagService.remove(id);
  }
}
