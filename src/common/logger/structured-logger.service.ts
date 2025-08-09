import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { Request } from 'express';

export interface LogContext {
  userId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  module?: string;
  action?: string;
  resource?: string;
  metadata?: Record<string, any>;
}

@Injectable({ scope: Scope.TRANSIENT })
export class StructuredLoggerService implements LoggerService {
  private readonly logger: winston.Logger;
  private context: LogContext = {};

  constructor(private readonly configService: ConfigService) {
    this.logger = this.createLogger();
  }

  /**
   * 创建Winston日志器
   */
  private createLogger(): winston.Logger {
    const logLevel = this.configService.get<string>('logging.level', 'info');
    const enableConsole = this.configService.get<boolean>(
      'logging.enableConsole',
      true,
    );
    const enableFile = this.configService.get<boolean>(
      'logging.enableFile',
      false,
    );
    const filePath = this.configService.get<string>(
      'logging.filePath',
      './logs',
    );
    const maxFiles = this.configService.get<string>('logging.maxFiles', '14d');
    const maxFileSize = this.configService.get<string>(
      'logging.maxFileSize',
      '20m',
    );

    const transports: winston.transport[] = [];

    // 控制台输出
    if (enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length
                ? JSON.stringify(meta, null, 2)
                : '';
              return `${String(timestamp)} [${String(level)}] ${String(message)} ${metaStr}`;
            }),
          ),
        }),
      );
    }

    // 文件输出 - 简化为两个文件：应用日志和错误日志
    if (enableFile) {
      // 应用日志
      transports.push(
        new DailyRotateFile({
          filename: `${filePath}/application-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          maxFiles,
          maxSize: maxFileSize,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      );

      // 错误日志
      transports.push(
        new DailyRotateFile({
          filename: `${filePath}/error-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          maxFiles,
          maxSize: maxFileSize,
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      );
    }

    return winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      transports,
      exitOnError: false,
      // 异常处理
      exceptionHandlers: enableFile
        ? [
            new DailyRotateFile({
              filename: `${filePath}/exceptions-%DATE%.log`,
              datePattern: 'YYYY-MM-DD',
              maxFiles,
              maxSize: maxFileSize,
            }),
          ]
        : undefined,
      // 拒绝处理
      rejectionHandlers: enableFile
        ? [
            new DailyRotateFile({
              filename: `${filePath}/rejections-%DATE%.log`,
              datePattern: 'YYYY-MM-DD',
              maxFiles,
              maxSize: maxFileSize,
            }),
          ]
        : undefined,
    });
  }

  /**
   * 设置日志上下文
   */
  setContext(context: Partial<LogContext>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * 从请求中设置上下文
   */
  setContextFromRequest(req: Request): void {
    this.setContext({
      requestId:
        (req.headers['x-request-id'] as string) || this.generateRequestId(),
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'],
      method: req.method,
      url: req.url,
      userId: (req as Request & { user?: { id: string } }).user?.id,
    });
  }

  /**
   * 清除上下文
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * 基础日志方法（异步）
   */
  log(message: string, context?: Partial<LogContext>): void {
    setImmediate(() => {
      this.logger.info(message, { ...this.context, ...context });
    });
  }

  error(message: string, trace?: string, context?: Partial<LogContext>): void {
    // 错误日志保持同步，确保重要信息不丢失
    this.logger.error(message, {
      ...this.context,
      ...context,
      stack: trace,
      logType: 'error',
    });
  }

  warn(message: string, context?: Partial<LogContext>): void {
    setImmediate(() => {
      this.logger.warn(message, {
        ...this.context,
        ...context,
        logType: 'warning',
      });
    });
  }

  debug(message: string, context?: Partial<LogContext>): void {
    setImmediate(() => {
      this.logger.debug(message, {
        ...this.context,
        ...context,
        logType: 'debug',
      });
    });
  }

  verbose(message: string, context?: Partial<LogContext>): void {
    setImmediate(() => {
      this.logger.verbose(message, {
        ...this.context,
        ...context,
        logType: 'verbose',
      });
    });
  }

  /**
   * 安全相关日志（异步，错误级别保持同步）
   */
  security(
    message: string,
    level: 'info' | 'warn' | 'error' = 'warn',
    context?: Partial<LogContext>,
  ): void {
    const securityContext = {
      ...this.context,
      ...context,
      logType: 'security',
      category: 'security',
    };

    switch (level) {
      case 'error':
        // 安全错误日志保持同步
        this.logger.error(message, securityContext);
        break;
      case 'warn':
        setImmediate(() => {
          this.logger.warn(message, securityContext);
        });
        break;
      default:
        setImmediate(() => {
          this.logger.info(message, securityContext);
        });
    }
  }

  /**
   * 业务相关日志（异步，错误级别保持同步）
   */
  business(
    message: string,
    level: 'info' | 'warn' | 'error' = 'info',
    context?: Partial<LogContext>,
  ): void {
    const businessContext = {
      ...this.context,
      ...context,
      logType: 'business',
      category: 'business',
    };

    switch (level) {
      case 'error':
        // 业务错误日志保持同步
        this.logger.error(message, businessContext);
        break;
      case 'warn':
        setImmediate(() => {
          this.logger.warn(message, businessContext);
        });
        break;
      default:
        setImmediate(() => {
          this.logger.info(message, businessContext);
        });
    }
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取客户端IP
   */
  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * 创建子日志器
   */
  child(context: Partial<LogContext>): StructuredLoggerService {
    const childLogger = new StructuredLoggerService(this.configService);
    childLogger.setContext({ ...this.context, ...context });
    return childLogger;
  }
}
