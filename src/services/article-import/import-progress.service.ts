import { Injectable } from '@nestjs/common';
import {
  ImportProgressDto,
  ImportStatus,
  StartImportResponseDto,
} from '@/dto/article-import.dto';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';

@Injectable()
export class ImportProgressService {
  // 内存存储进度信息
  private progressStore = new Map<string, ImportProgressDto>();

  constructor(private readonly logger: StructuredLoggerService) {}

  /**
   * 初始化导入进度
   */
  initializeProgress(
    taskId: string,
    totalFiles: number,
  ): StartImportResponseDto {
    this.logger.log(`初始化导入任务 ${taskId}，共 ${totalFiles} 个文件`, {
      metadata: { taskId, totalFiles },
    });

    const progress: ImportProgressDto = {
      taskId,
      status: ImportStatus.PENDING,
      totalFiles,
      processedFiles: 0,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      currentFile: '',
      progress: 0,
      startTime: Date.now(),
      estimatedTimeRemaining: 0,
    };

    this.progressStore.set(taskId, progress);

    return {
      taskId,
      status: ImportStatus.PENDING,
      totalFiles,
      message: '导入任务已创建',
    };
  }

  /**
   * 获取导入进度
   */
  getImportProgress(taskId: string): ImportProgressDto | null {
    return this.progressStore.get(taskId) || null;
  }

  /**
   * 更新进度信息
   */
  updateProgress(taskId: string, updates: Partial<ImportProgressDto>): void {
    const current = this.progressStore.get(taskId);
    if (current) {
      const updated = { ...current, ...updates };
      this.progressStore.set(taskId, updated);
    }
  }

  /**
   * 更新当前处理的文件信息
   */
  updateCurrentFile(
    taskId: string,
    fileName: string,
    processedFiles: number,
    totalFiles: number,
  ): void {
    this.updateProgress(taskId, {
      currentFile: fileName,
      processedFiles,
      progress: Math.round((processedFiles / totalFiles) * 100),
    });
  }

  /**
   * 处理文件后更新进度
   */
  updateProgressAfterFile(
    taskId: string,
    processedFiles: number,
    totalFiles: number,
    counters: {
      successCount: number;
      failureCount: number;
      skippedCount: number;
    },
    startTime: number,
  ): void {
    this.updateProgress(taskId, {
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
  markAsProcessing(taskId: string): void {
    this.updateProgress(taskId, {
      status: ImportStatus.PROCESSING,
    });
  }

  /**
   * 标记任务为完成状态
   */
  markTaskCompleted(taskId: string, results: any[]): void {
    this.updateProgress(taskId, {
      status: ImportStatus.COMPLETED,
      progress: 100,
      results,
    });
  }

  /**
   * 标记任务为失败状态
   */
  markAsFailed(taskId: string, error: string): void {
    this.updateProgress(taskId, {
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
  getImportStatistics(taskId: string): {
    totalFiles: number;
    processedFiles: number;
    successRate: number;
    averageProcessingTime: number;
  } | null {
    const progress = this.getImportProgress(taskId);
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
  cancelImportTask(taskId: string): boolean {
    const progress = this.progressStore.get(taskId);
    if (progress) {
      progress.status = ImportStatus.FAILED;
      this.progressStore.set(taskId, progress);
      return true;
    }
    return false;
  }

  /**
   * 清理过期的导入进度
   */
  cleanupExpiredProgress(): void {
    const now = Date.now();
    const expiredTasks: string[] = [];

    for (const [taskId, progress] of this.progressStore.entries()) {
      // 清理超过1小时的任务
      if (now - progress.startTime > 3600000) {
        expiredTasks.push(taskId);
      }
    }

    expiredTasks.forEach((taskId) => this.progressStore.delete(taskId));
  }
}
