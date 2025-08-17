import { Controller, Get, Delete, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  DevCacheService,
  CacheOverview,
  CacheItem,
} from '../services/dev-cache.service';
import { Public } from '../decorators/public.decorator';

@ApiTags('6 开发工具API - 缓存管理')
@Controller('dev/cache')
@Public() // 开发环境不需要认证
export class DevCacheController {
  constructor(private readonly devCacheService: DevCacheService) {}

  @Get('overview')
  @ApiOperation({ summary: '获取缓存概览' })
  @ApiResponse({
    status: 200,
    description: '缓存概览信息',
    type: Object,
  })
  async getCacheOverview(): Promise<CacheOverview> {
    return await this.devCacheService.getCacheOverview();
  }

  @Get('keys')
  @ApiOperation({ summary: '获取所有缓存键' })
  @ApiQuery({ name: 'pattern', required: false, description: '搜索模式' })
  @ApiResponse({ status: 200, description: '缓存键列表' })
  async getAllCacheKeys(@Query('pattern') pattern?: string): Promise<string[]> {
    return await this.devCacheService.getAllCacheKeys(pattern);
  }

  @Get('data/:key')
  @ApiOperation({ summary: '获取指定缓存数据' })
  @ApiParam({ name: 'key', description: '缓存键' })
  @ApiResponse({ status: 200, description: '缓存数据' })
  async getCacheData(@Param('key') key: string): Promise<CacheItem | null> {
    return await this.devCacheService.getCacheData(key);
  }

  @Get('stats')
  @ApiOperation({ summary: '获取缓存统计信息' })
  @ApiResponse({ status: 200, description: '缓存统计信息' })
  async getCacheStats() {
    return await this.devCacheService.getCacheStats();
  }

  @Delete('clear/:key')
  @ApiOperation({ summary: '清除指定缓存' })
  @ApiParam({ name: 'key', description: '缓存键' })
  @ApiResponse({ status: 200, description: '清除结果' })
  async clearCache(@Param('key') key: string) {
    return await this.devCacheService.clearCache(key);
  }

  @Delete('clear-all')
  @ApiOperation({ summary: '清除所有缓存' })
  @ApiResponse({ status: 200, description: '清除结果' })
  async clearAllCache() {
    return await this.devCacheService.clearAllCache();
  }

  @Get('memory-usage')
  @ApiOperation({ summary: '获取内存使用情况' })
  @ApiResponse({ status: 200, description: '内存使用情况' })
  getMemoryUsage() {
    return this.devCacheService.getMemoryUsage();
  }
}
