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

export interface SecurityLogContext extends LogContext {
  securityEvent: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  threatType?: string;
  sourceIp?: string;
  targetResource?: string;
}

export interface PerformanceLogContext extends LogContext {
  operation: string;
  duration: number;
  memoryUsage?: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
  dbQueryCount?: number;
  cacheHitRate?: number;
}

export interface BusinessLogContext extends LogContext {
  businessEvent: string;
  entityType?: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  changeReason?: string;
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

    // 文件输出
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

      // 安全日志
      transports.push(
        new DailyRotateFile({
          filename: `${filePath}/security-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          maxFiles,
          maxSize: maxFileSize,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      );

      // 性能日志
      transports.push(
        new DailyRotateFile({
          filename: `${filePath}/performance-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          maxFiles,
          maxSize: maxFileSize,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      );

      // 业务日志
      transports.push(
        new DailyRotateFile({
          filename: `${filePath}/business-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          maxFiles,
          maxSize: maxFileSize,
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
        : [],
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
        : [],
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
   * 基础日志方法
   */
  log(message: string, context?: Partial<LogContext>): void {
    this.logger.info(message, { ...this.context, ...context });
  }

  error(message: string, trace?: string, context?: Partial<LogContext>): void {
    this.logger.error(message, {
      ...this.context,
      ...context,
      stack: trace,
      logType: 'error',
    });
  }

  warn(message: string, context?: Partial<LogContext>): void {
    this.logger.warn(message, {
      ...this.context,
      ...context,
      logType: 'warning',
    });
  }

  debug(message: string, context?: Partial<LogContext>): void {
    this.logger.debug(message, {
      ...this.context,
      ...context,
      logType: 'debug',
    });
  }

  verbose(message: string, context?: Partial<LogContext>): void {
    this.logger.verbose(message, {
      ...this.context,
      ...context,
      logType: 'verbose',
    });
  }

  /**
   * 安全日志
   */
  security(message: string, context: SecurityLogContext): void {
    this.logger.info(message, {
      ...this.context,
      ...context,
      logType: 'security',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 性能日志
   */
  performance(message: string, context: PerformanceLogContext): void {
    this.logger.info(message, {
      ...this.context,
      ...context,
      logType: 'performance',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 业务日志
   */
  business(message: string, context: BusinessLogContext): void {
    this.logger.info(message, {
      ...this.context,
      ...context,
      logType: 'business',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * API访问日志
   */
  access(
    message: string,
    context: LogContext & {
      statusCode: number;
      responseTime: number;
      contentLength?: number;
    },
  ): void {
    this.logger.info(message, {
      ...this.context,
      ...context,
      logType: 'access',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 数据库操作日志
   */
  database(
    message: string,
    context: LogContext & {
      operation: string;
      table: string;
      duration: number;
      affectedRows?: number;
      query?: string;
    },
  ): void {
    this.logger.info(message, {
      ...this.context,
      ...context,
      logType: 'database',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 缓存操作日志
   */
  cache(
    message: string,
    context: LogContext & {
      operation: 'get' | 'set' | 'del' | 'clear';
      key: string;
      hit?: boolean;
      ttl?: number;
    },
  ): void {
    this.logger.debug(message, {
      ...this.context,
      ...context,
      logType: 'cache',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 外部服务调用日志
   */
  external(
    message: string,
    context: LogContext & {
      service: string;
      endpoint: string;
      method: string;
      statusCode?: number;
      duration: number;
      requestSize?: number;
      responseSize?: number;
    },
  ): void {
    this.logger.info(message, {
      ...this.context,
      ...context,
      logType: 'external',
      timestamp: new Date().toISOString(),
    });
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

  /**
   * 获取日志统计信息
   */
  getStats(): {
    level: string;
    transports: number;
    context: LogContext;
  } {
    return {
      level: this.logger.level,
      transports: this.logger.transports.length,
      context: this.context,
    };
  }
}
