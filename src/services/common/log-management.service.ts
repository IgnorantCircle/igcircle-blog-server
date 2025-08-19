import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs/promises';
import * as path from 'path';
import archiver from 'archiver';
import { createWriteStream } from 'fs';

/**
 * 日志管理服务
 * 负责日志的按日期目录分类、自动压缩和清理
 */
@Injectable()
export class LogManagementService {
  private readonly logger = new Logger(LogManagementService.name);
  private readonly logBasePath: string;
  private readonly maxLogDays: number;

  constructor(private readonly configService: ConfigService) {
    this.logBasePath = this.configService.get<string>(
      'logging.filePath',
      './logs',
    );
    this.maxLogDays = this.configService.get<number>('logging.maxLogDays', 30);
  }

  /**
   * 获取按日期分类的日志目录路径
   * @param date 日期，默认为今天
   * @returns 日志目录路径
   */
  getLogDirectoryPath(date: Date = new Date()): string {
    const dateStr = this.formatDate(date);
    return path.join(this.logBasePath, dateStr);
  }

  /**
   * 确保日志目录存在
   * @param date 日期
   */
  async ensureLogDirectory(date: Date = new Date()): Promise<string> {
    const logDir = this.getLogDirectoryPath(date);
    try {
      await fs.access(logDir);
    } catch {
      await fs.mkdir(logDir, { recursive: true });
      this.logger.log(`创建日志目录: ${logDir}`);
    }
    return logDir;
  }

  /**
   * 每天凌晨0点执行：压缩前一天的日志目录
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async compressPreviousDayLogs(): Promise<void> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const logDir = this.getLogDirectoryPath(yesterday);
      const compressedPath = `${logDir}.tar.gz`;

      // 检查目录是否存在
      try {
        await fs.access(logDir);
      } catch {
        this.logger.warn(`日志目录不存在，跳过压缩: ${logDir}`);
        return;
      }

      // 检查是否已经压缩过
      try {
        await fs.access(compressedPath);
        this.logger.warn(`日志已压缩，跳过: ${compressedPath}`);
        return;
      } catch {
        // 文件不存在，继续压缩
      }

      await this.compressDirectory(logDir, compressedPath);

      // 压缩成功后删除原目录
      await fs.rm(logDir, { recursive: true, force: true });

      this.logger.log(`成功压缩并删除日志目录: ${logDir} -> ${compressedPath}`);
    } catch (error) {
      this.logger.error(
        '压缩前一天日志失败',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * 每天凌晨1点执行：清理超过指定天数的日志
   */
  @Cron('0 1 * * *')
  async cleanupOldLogs(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.maxLogDays);

      this.logger.log(`开始清理 ${this.formatDate(cutoffDate)} 之前的日志`);

      // 获取日志基础目录下的所有文件和目录
      const items = await fs.readdir(this.logBasePath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(this.logBasePath, item.name);

        // 检查是否是日期格式的目录或压缩文件
        const dateMatch = item.name.match(/^(\d{4}-\d{2}-\d{2})(\.tar\.gz)?$/);
        if (!dateMatch) {
          continue;
        }

        const itemDate = new Date(dateMatch[1]);
        if (itemDate < cutoffDate) {
          if (item.isDirectory()) {
            await fs.rm(itemPath, { recursive: true, force: true });
            this.logger.log(`删除过期日志目录: ${itemPath}`);
          } else if (item.isFile() && item.name.endsWith('.tar.gz')) {
            await fs.unlink(itemPath);
            this.logger.log(`删除过期日志压缩文件: ${itemPath}`);
          }
        }
      }

      this.logger.log('日志清理完成');
    } catch (error) {
      this.logger.error(
        '清理过期日志失败',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * 压缩目录为tar.gz文件
   * @param sourceDir 源目录
   * @param outputPath 输出文件路径
   */
  private async compressDirectory(
    sourceDir: string,
    outputPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver('tar', {
        gzip: true,
        gzipOptions: {
          level: 9, // 最高压缩级别
        },
      });

      output.on('close', () => {
        this.logger.log(`压缩完成: ${outputPath} (${archive.pointer()} bytes)`);
        resolve();
      });

      archive.on('error', (err: Error) => {
        this.logger.error(`压缩失败: ${err.message}`);
        reject(err);
      });

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  /**
   * 格式化日期为YYYY-MM-DD格式
   * @param date 日期
   * @returns 格式化的日期字符串
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * 手动触发压缩指定日期的日志
   * @param date 要压缩的日期
   */
  async compressLogsByDate(date: Date): Promise<void> {
    const logDir = this.getLogDirectoryPath(date);
    const compressedPath = `${logDir}.tar.gz`;

    try {
      await fs.access(logDir);
    } catch {
      throw new Error(`日志目录不存在: ${logDir}`);
    }

    await this.compressDirectory(logDir, compressedPath);
    await fs.rm(logDir, { recursive: true, force: true });

    this.logger.log(`手动压缩完成: ${logDir} -> ${compressedPath}`);
  }

  /**
   * 获取日志统计信息
   */
  async getLogStatistics(): Promise<{
    totalDirectories: number;
    totalCompressedFiles: number;
    oldestLogDate: string | null;
    newestLogDate: string | null;
    totalSize: number;
  }> {
    try {
      const items = await fs.readdir(this.logBasePath, { withFileTypes: true });

      let totalDirectories = 0;
      let totalCompressedFiles = 0;
      let totalSize = 0;
      const dates: string[] = [];

      for (const item of items) {
        const itemPath = path.join(this.logBasePath, item.name);
        const dateMatch = item.name.match(/^(\d{4}-\d{2}-\d{2})(\.tar\.gz)?$/);

        if (dateMatch) {
          dates.push(dateMatch[1]);

          if (item.isDirectory()) {
            totalDirectories++;
          } else if (item.isFile() && item.name.endsWith('.tar.gz')) {
            totalCompressedFiles++;
          }

          const stats = await fs.stat(itemPath);
          totalSize += stats.size;
        }
      }

      dates.sort();

      return {
        totalDirectories,
        totalCompressedFiles,
        oldestLogDate: dates.length > 0 ? dates[0] : null,
        newestLogDate: dates.length > 0 ? dates[dates.length - 1] : null,
        totalSize,
      };
    } catch (error) {
      this.logger.error(
        '获取日志统计信息失败',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
