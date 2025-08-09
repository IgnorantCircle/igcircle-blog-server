import { Injectable } from '@nestjs/common';
import { CacheService } from '@/common/cache/cache.service';
import { CACHE_TYPES } from '@/common/cache/cache.config';
import {
  ImportProgressDto,
  ImportStatus,
  StartImportResponseDto,
} from '@/dto/article-import.dto';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';

@Injectable()
export class ImportProgressService {
  // 常量定义
  private static readonly CACHE_TTL = 3600000; // 1小时
  private static readonly PROGRESS_CACHE_PREFIX = 'import_progress_';

  constructor(
    private readonly cacheService: CacheService,
    private readonly logger: StructuredLoggerService,
  ) {}

  /**
   * 初始化导入进度
   */
  async initializeProgress(
    taskId: string,
    totalFiles: number,
  ): Promise<StartImportResponseDto> {
    this.logger.log(`初始化导入任务 ${taskId}，共 ${totalFiles} 个文件`, {
      metadata: { taskId, totalFiles },
    });

    // 初始化进度信息
    const initialProgress: ImportProgressDto = {
      taskId,
      status: ImportStatus.PENDING,
      totalFiles,
      processedFiles: 0,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      progress: 0,
      startTime: Date.now(),
    };

    // 存储进度信息到缓存
    await this.cacheService.set(
      `${ImportProgressService.PROGRESS_CACHE_PREFIX}${taskId}`,
      initialProgress,
      {
        type: CACHE_TYPES.TEMP,
        ttl: ImportProgressService.CACHE_TTL / 1000, // 转换为秒
      },
    );

    return {
      taskId,
      status: ImportStatus.PENDING,
      totalFiles,
      message: '导入任务已开始，请使用任务ID查询进度',
    };
  }

  /**
   * 获取导入进度
   */
  async getImportProgress(taskId: string): Promise<ImportProgressDto | null> {
    const progress = await this.cacheService.get<ImportProgressDto>(
      `${ImportProgressService.PROGRESS_CACHE_PREFIX}${taskId}`,
      { type: CACHE_TYPES.TEMP },
    );
    return progress || null;
  }

  /**
   * 更新进度信息
   */
  async updateProgress(
    taskId: string,
    updates: Partial<ImportProgressDto>,
  ): Promise<void> {
    const cacheKey = `${ImportProgressService.PROGRESS_CACHE_PREFIX}${taskId}`;
    const currentProgress = await this.cacheService.get<ImportProgressDto>(
      cacheKey,
      { type: CACHE_TYPES.TEMP },
    );

    if (currentProgress) {
      const updatedProgress = { ...currentProgress, ...updates };
      await this.cacheService.set(cacheKey, updatedProgress, {
        type: CACHE_TYPES.TEMP,
        ttl: ImportProgressService.CACHE_TTL / 1000, // 转换为秒
      });
    }
  }

  /**
   * 更新当前处理的文件信息
   */
  async updateCurrentFile(
    taskId: string,
    fileName: string,
    processedFiles: number,
    totalFiles: number,
  ): Promise<void> {
    await this.updateProgress(taskId, {
      currentFile: fileName,
      processedFiles,
      progress: Math.round((processedFiles / totalFiles) * 100),
    });
  }

  /**
   * 处理文件后更新进度
   */
  async updateProgressAfterFile(
    taskId: string,
    processedFiles: number,
    totalFiles: number,
    counters: {
      successCount: number;
      failureCount: number;
      skippedCount: number;
    },
    startTime: number,
  ): Promise<void> {
    await this.updateProgress(taskId, {
      processedFiles,
      successCount: counters.successCount,
      failureCount: counters.failureCount,
      skippedCount: counters.skippedCount,
      progress: Math.round((processedFiles / totalFiles) * 100),
      estimatedTimeRemaining: this.calculateEstimatedTime(
        startTime,
        processedFiles,
        totalFiles,
      ),
    });
  }

  /**
   * 标记任务为处理中状态
   */
  async markAsProcessing(taskId: string): Promise<void> {
    await this.updateProgress(taskId, {
      status: ImportStatus.PROCESSING,
    });
  }

  /**
   * 标记任务为完成状态
   */
  async markTaskCompleted(taskId: string, results: any[]): Promise<void> {
    await this.updateProgress(taskId, {
      status: ImportStatus.COMPLETED,
      progress: 100,
      results,
    });
  }

  /**
   * 标记任务为失败状态
   */
  async markAsFailed(taskId: string, error: string): Promise<void> {
    await this.updateProgress(taskId, {
      status: ImportStatus.FAILED,
      error,
    });
  }

  /**
   * 计算预计剩余时间
   */
  private calculateEstimatedTime(
    startTime: number,
    processedCount: number,
    totalCount: number,
  ): number {
    if (processedCount === 0) return 0;

    const elapsedTime = Date.now() - startTime;
    const averageTimePerFile = elapsedTime / processedCount;
    const remainingFiles = totalCount - processedCount;

    return Math.round(remainingFiles * averageTimePerFile);
  }

  /**
   * 生成任务ID
   */
  generateTaskId(): string {
    return `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取导入统计信息
   */
  async getImportStatistics(taskId: string): Promise<{
    totalFiles: number;
    processedFiles: number;
    successRate: number;
    averageProcessingTime: number;
  } | null> {
    const progress = await this.getImportProgress(taskId);
    if (!progress) return null;

    const successRate =
      progress.totalFiles > 0
        ? (progress.successCount / progress.totalFiles) * 100
        : 0;

    const elapsedTime = Date.now() - progress.startTime;
    const averageProcessingTime =
      progress.processedFiles > 0 ? elapsedTime / progress.processedFiles : 0;

    return {
      totalFiles: progress.totalFiles,
      processedFiles: progress.processedFiles,
      successRate: Math.round(successRate * 100) / 100,
      averageProcessingTime: Math.round(averageProcessingTime),
    };
  }

  /**
   * 取消导入任务
   */
  async cancelImportTask(taskId: string): Promise<boolean> {
    try {
      const cacheKey = `${ImportProgressService.PROGRESS_CACHE_PREFIX}${taskId}`;
      const progress = await this.cacheService.get<ImportProgressDto>(
        cacheKey,
        { type: CACHE_TYPES.TEMP },
      );

      if (progress && progress.status === ImportStatus.PROCESSING) {
        await this.updateProgress(taskId, {
          status: ImportStatus.FAILED,
          error: '任务已被用户取消',
        });
        this.logger.log(`导入任务 ${taskId} 已被取消`, {
          metadata: { taskId },
        });
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(
        `取消导入任务 ${taskId} 失败`,
        error instanceof Error ? error.stack : undefined,
        {
          metadata: {
            taskId,
            error: error instanceof Error ? error.message : '未知错误',
          },
        },
      );
      return false;
    }
  }

  /**
   * 清理过期的导入进度缓存
   */
  async cleanupExpiredProgress(): Promise<void> {
    try {
      // 这里可以实现清理逻辑，具体实现取决于缓存管理器的能力
      this.logger.log('清理过期的导入进度缓存');
      await Promise.resolve();
    } catch (error) {
      this.logger.error(
        '清理过期缓存失败',
        error instanceof Error ? error.stack : undefined,
        {
          metadata: {
            error: error instanceof Error ? error.message : '未知错误',
          },
        },
      );
    }
  }
}
