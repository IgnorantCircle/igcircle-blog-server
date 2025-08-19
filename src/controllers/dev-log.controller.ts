import {
  Controller,
  Post,
  Get,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { LogManagementService } from '../services/common/log-management.service';
import { Public } from '../decorators/public.decorator';

/**
 * 开发环境日志管理控制器
 * 提供日志压缩、统计和清理的API接口
 */
@ApiTags('开发工具 - 日志管理')
@Controller('dev/logs')
@Public() // 开发环境不需要认证
export class DevLogController {
  constructor(private readonly logManagementService: LogManagementService) {}

  /**
   * 手动压缩指定日期的日志
   */
  @Post('compress/:date')
  @ApiOperation({ summary: '手动压缩指定日期的日志' })
  @ApiParam({
    name: 'date',
    description: '日期 (YYYY-MM-DD)',
    example: '2025-08-17',
  })
  @ApiResponse({ status: 200, description: '压缩成功' })
  @ApiResponse({ status: 400, description: '日期格式错误或日志目录不存在' })
  @ApiResponse({ status: 500, description: '压缩失败' })
  async compressLogsByDate(@Param('date') dateStr: string) {
    try {
      // 验证日期格式
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateStr)) {
        throw new HttpException(
          '日期格式错误，请使用 YYYY-MM-DD 格式',
          HttpStatus.BAD_REQUEST,
        );
      }

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        throw new HttpException('无效的日期', HttpStatus.BAD_REQUEST);
      }

      await this.logManagementService.compressLogsByDate(date);

      return {
        success: true,
        message: `成功压缩 ${dateStr} 的日志`,
        date: dateStr,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new HttpException(
        `压缩日志失败: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 获取日志统计信息
   */
  @Get('statistics')
  @ApiOperation({ summary: '获取日志统计信息' })
  @ApiResponse({
    status: 200,
    description: '日志统计信息',
    schema: {
      type: 'object',
      properties: {
        totalDirectories: { type: 'number', description: '日志目录总数' },
        totalCompressedFiles: {
          type: 'number',
          description: '压缩文件总数',
        },
        oldestLogDate: { type: 'string', description: '最早日志日期' },
        newestLogDate: { type: 'string', description: '最新日志日期' },
        totalSize: { type: 'number', description: '总大小（字节）' },
      },
    },
  })
  @ApiResponse({ status: 500, description: '获取统计信息失败' })
  async getLogStatistics() {
    try {
      const stats = await this.logManagementService.getLogStatistics();
      return {
        success: true,
        data: {
          ...stats,
          totalSizeFormatted: this.formatBytes(stats.totalSize),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new HttpException(
        `获取日志统计信息失败: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 手动清理过期日志
   */
  @Post('cleanup')
  @ApiOperation({ summary: '手动清理过期日志' })
  @ApiResponse({ status: 200, description: '清理成功' })
  @ApiResponse({ status: 500, description: '清理失败' })
  async cleanupOldLogs() {
    try {
      await this.logManagementService.cleanupOldLogs();

      return {
        success: true,
        message: '过期日志清理完成',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new HttpException(
        `清理过期日志失败: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 格式化字节数为可读格式
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
