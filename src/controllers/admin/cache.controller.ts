import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/guards/auth.guard';
import { RolesGuard } from '@/guards/roles.guard';
import { Roles } from '@/decorators/roles.decorator';
import { Role } from '@/enums/role.enum';
import { CacheStrategyService } from '@/common/cache/cache-strategy.service';
import { CacheManagerService } from '@/common/cache/cache-manager.service';
import { CacheMonitorService } from '@/common/cache/cache-monitor.service';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';

interface ClearCacheDto {
  tags?: string[];
  patterns?: string[];
  types?: string[];
}

interface WarmupCacheDto {
  types: string[];
}

@Controller('admin/cache')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminCacheController {
  constructor(
    private readonly cacheStrategy: CacheStrategyService,
    private readonly cacheManager: CacheManagerService,
    private readonly cacheMonitor: CacheMonitorService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext({ module: 'AdminCacheController' });
  }

  /**
   * 获取缓存统计信息
   */
  @Get('stats')
  async getCacheStats() {
    try {
      const metrics = await this.cacheManager.getCacheMetrics();
      const config = this.cacheManager.exportCacheConfig();
      const health = await this.cacheManager.healthCheck();
      const monitorMetrics = await this.cacheMonitor.getCurrentMetrics();
      const healthScore = await this.cacheMonitor.getHealthScore();

      return {
        metrics,
        config,
        health,
        monitoring: {
          current: monitorMetrics,
          byType: this.cacheMonitor.getMetricsByType(),
          healthScore,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats', (error as Error).message);
      throw error;
    }
  }

  /**
   * 缓存健康检查
   */
  @Get('health')
  async healthCheck() {
    try {
      return await this.cacheManager.healthCheck();
    } catch (error) {
      this.logger.error('Cache health check failed', (error as Error).message);
      throw error;
    }
  }

  /**
   * 清除缓存
   */
  @Post('clear')
  @HttpCode(HttpStatus.OK)
  async clearCache(@Body() clearCacheDto: ClearCacheDto) {
    try {
      const { tags, patterns, types } = clearCacheDto;
      const operations: Promise<void>[] = [];

      // 按标签清除
      if (tags && tags.length > 0) {
        operations.push(this.cacheStrategy.clearByTags(tags));
      }

      // 按模式清除
      if (patterns && patterns.length > 0) {
        operations.push(this.cacheManager.batchDelete(patterns));
      }

      // 按类型清除（通过标签实现）
      if (types && types.length > 0) {
        operations.push(this.cacheStrategy.clearByTags(types));
      }

      // 如果没有指定任何条件，清除所有缓存
      if (!tags && !patterns && !types) {
        operations.push(this.cacheStrategy.clearAll());
      }

      await Promise.all(operations);

      this.logger.log(
        `Cache cleared successfully: tags=${tags?.join(',') || 'none'}, patterns=${patterns?.join(',') || 'none'}, types=${types?.join(',') || 'none'}`,
      );

      return {
        message: 'Cache cleared successfully',
        clearedTags: tags,
        clearedPatterns: patterns,
        clearedTypes: types,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        'Failed to clear cache',
        `Error: ${(error as Error).message}, DTO: ${JSON.stringify(clearCacheDto)}`,
      );
      throw error;
    }
  }

  /**
   * 清除所有缓存
   */
  @Delete('all')
  @HttpCode(HttpStatus.OK)
  async clearAllCache() {
    try {
      await this.cacheStrategy.clearAll();

      this.logger.log('All cache cleared successfully');

      return {
        message: 'All cache cleared successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to clear all cache', (error as Error).message);
      throw error;
    }
  }

  /**
   * 预热缓存
   */
  @Post('warmup')
  @HttpCode(HttpStatus.OK)
  async warmupCache(@Body() warmupDto: WarmupCacheDto) {
    try {
      const { types } = warmupDto;

      // 这里可以根据类型预热不同的缓存
      // 实际实现需要根据具体的业务逻辑来定义
      const warmupConfigs = types
        .map((type) => {
          switch (type) {
            case 'article':
              return {
                type: 'article',
                dataLoader: async () => {
                  // 这里应该调用ArticleService获取热门文章
                  return [];
                },
                keyExtractor: (item: any) => item.id,
              };
            case 'user':
              return {
                type: 'user',
                dataLoader: async () => {
                  // 这里应该调用UserService获取活跃用户
                  return [];
                },
                keyExtractor: (item: any) => item.id,
              };
            default:
              return null;
          }
        })
        .filter(Boolean);

      const validConfigs = warmupConfigs.filter(
        (config): config is NonNullable<typeof config> => config !== null,
      );
      if (validConfigs.length > 0) {
        await this.cacheManager.batchWarmup(validConfigs);
      }

      this.logger.log(`Cache warmup completed for types: ${types.join(', ')}`);

      return {
        message: 'Cache warmup completed',
        warmedTypes: types,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        'Failed to warmup cache',
        `Error: ${(error as Error).message}, DTO: ${JSON.stringify(warmupDto)}`,
      );
      throw error;
    }
  }

  /**
   * 清理过期缓存
   */
  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  async cleanupCache() {
    try {
      await this.cacheManager.cleanupExpiredCache();

      this.logger.log('Cache cleanup completed');

      return {
        message: 'Cache cleanup completed',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to cleanup cache', (error as Error).message);
      throw error;
    }
  }

  /**
   * 获取缓存配置
   */
  @Get('config')
  async getCacheConfig() {
    try {
      return this.cacheManager.exportCacheConfig();
    } catch (error) {
      this.logger.error('Failed to get cache config', (error as Error).message);
      throw error;
    }
  }

  /**
   * 按标签查询缓存键
   */
  @Get('keys')
  async getCacheKeys(
    @Query('pattern') pattern?: string,
    @Query('limit') limit: number = 100,
  ) {
    try {
      // 这里可以实现查询缓存键的逻辑
      // 由于安全考虑，限制返回的键数量
      const actualLimit = Math.min(limit, 1000);

      return {
        message: 'Cache keys query not implemented yet',
        pattern,
        limit: actualLimit,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        'Failed to get cache keys',
        `Error: ${(error as Error).message}, Pattern: ${pattern}`,
      );
      throw error;
    }
  }

  /**
   * 获取缓存性能报告
   */
  @Get('performance-report')
  async getPerformanceReport() {
    try {
      const report = await this.cacheMonitor.generatePerformanceReport();

      return {
        success: true,
        data: report,
      };
    } catch (error) {
      this.logger.error(
        'Failed to generate performance report',
        (error as Error).message,
      );
      throw error;
    }
  }

  /**
   * 重置缓存监控指标
   */
  @Post('reset-metrics')
  async resetMetrics() {
    try {
      this.cacheMonitor.resetMetrics();

      return {
        success: true,
        message: 'Cache metrics reset successfully',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        'Failed to reset cache metrics',
        (error as Error).message,
      );
      throw error;
    }
  }

  /**
   * 获取缓存健康评分
   */
  @Get('health-score')
  async getHealthScore() {
    try {
      const healthScore = await this.cacheMonitor.getHealthScore();

      return {
        success: true,
        data: healthScore,
      };
    } catch (error) {
      this.logger.error('Failed to get health score', (error as Error).message);
      throw error;
    }
  }
}
