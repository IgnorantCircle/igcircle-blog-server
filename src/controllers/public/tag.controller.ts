import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseInterceptors,
} from '@nestjs/common';
import { NotFoundException } from '@/common/exceptions/business.exception';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TagService } from '@/services/tag.service';
import { Public } from '@/decorators/public.decorator';
import { TagQueryDto } from '@/dto/tag.dto';
import { UnifiedTagDto } from '@/dto/base/unified-response.dto';
import { ErrorCode } from '@/common/constants/error-codes';
import {
  FieldVisibilityInterceptor,
  UsePublicVisibility,
} from '@/common/interceptors/field-visibility.interceptor';

@ApiTags('公共API - 标签')
@Controller('tags')
@Public()
@UseInterceptors(FieldVisibilityInterceptor)
export class PublicTagController {
  constructor(private readonly tagService: TagService) {}

  @Get()
  @UsePublicVisibility()
  @ApiOperation({ summary: '获取所有可见标签' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: [UnifiedTagDto],
  })
  async findAll(): Promise<any> {
    const query = new TagQueryDto();
    query.page = 1;
    query.limit = 100;
    query.isActive = true;
    const result = await this.tagService.findAllPaginated(query);

    return result.items;
  }

  @Get('popular')
  @UsePublicVisibility()
  @ApiOperation({ summary: '获取热门标签' })
  @ApiResponse({ status: 200, description: '获取成功', type: [UnifiedTagDto] })
  async findPopular(): Promise<any> {
    const tags = await this.tagService.getPopular({ limit: 20 });

    return tags;
  }

  @Get(':id')
  @UsePublicVisibility()
  @ApiOperation({ summary: '根据ID获取标签详情' })
  @ApiParam({ name: 'id', description: '标签ID' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: UnifiedTagDto,
  })
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<any> {
    const tag = await this.tagService.findById(id);

    // 检查标签是否激活
    if (!tag.isActive) {
      throw new NotFoundException(
        ErrorCode.TAG_NOT_FOUND,
        '标签不存在或已被禁用',
      );
    }

    return tag;
  }
}
