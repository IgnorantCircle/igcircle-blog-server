import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { Request } from 'express';
import { LogManagementService } from '../../services/common/log-management.service';

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

  private httpRequestFileConfig: {
    filePath: string;
    maxFiles: string;
    maxSize: string;
  } | null = null;
  private httpResponseFileConfig: {
    filePath: string;
    maxFiles: string;
    maxSize: string;
  } | null = null;
  private httpRequestLogger: winston.Logger | null = null;
  private httpResponseLogger: winston.Logger | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly logManagementService?: LogManagementService,
  ) {
    this.logger = this.createLogger();
    this.initializeHttpLoggers();
  }

  /**
   * 格式化控制台输出
   */
  private formatConsoleOutput(
    timestamp: string,
    level: string,
    message: string,
    meta: Record<string, any>,
  ): string {
    // 定义颜色和图标
    const colors = {
      error: '\x1b[31m', // 红色
      warn: '\x1b[33m', // 黄色
      info: '\x1b[36m', // 青色
      debug: '\x1b[35m', // 紫色
      verbose: '\x1b[37m', // 白色
    };

    const reset = '\x1b[0m';
    const bold = '\x1b[1m';
    const dim = '\x1b[2m';
    const green = '\x1b[32m';
    const blue = '\x1b[34m';

    // 获取日志级别（去掉winston的颜色代码）
    // eslint-disable-next-line no-control-regex
    const cleanLevel = level.replace(/\x1b\[[0-9;]*m/g, '');
    const levelColor = colors[cleanLevel as keyof typeof colors] || colors.info;

    // 格式化时间戳
    const formattedTime = `${dim}${String(timestamp)}${reset}`;

    // 格式化级别
    const formattedLevel = `${levelColor}${bold}${cleanLevel.toUpperCase().padEnd(5)}${reset}`;

    // 格式化消息
    const formattedMessage = `${bold}${String(message)}${reset}`;

    // 格式化元数据 - 优化关键字段显示
    let formattedMeta = '';
    if (Object.keys(meta).length > 0) {
      // 提取关键字段优先显示
      const keyFields = [
        'requestId',
        'method',
        'url',
        'statusCode',
        'responseTime',
        'ip',
        'userId',
      ];
      const priorityEntries: string[] = [];
      const otherEntries: string[] = [];

      Object.entries(meta)
        .filter(([, value]) => value !== undefined && value !== null)
        .forEach(([key, value]) => {
          let formattedEntry = '';

          if (key === 'requestId') {
            formattedEntry = `${blue}${bold}${key}:${reset} ${green}${String(value)}${reset}`;
          } else if (key === 'method') {
            formattedEntry = `${dim}${key}:${reset} ${bold}${String(value)}${reset}`;
          } else if (key === 'url') {
            formattedEntry = `${dim}${key}:${reset} ${blue}${String(value)}${reset}`;
          } else if (key === 'statusCode') {
            const statusColor =
              Number(value) >= 400
                ? '\x1b[31m'
                : Number(value) >= 300
                  ? '\x1b[33m'
                  : '\x1b[32m';
            formattedEntry = `${dim}${key}:${reset} ${statusColor}${bold}${String(value)}${reset}`;
          } else if (key === 'responseTime') {
            const timeColor =
              Number(value) > 1000
                ? '\x1b[31m'
                : Number(value) > 500
                  ? '\x1b[33m'
                  : '\x1b[32m';
            formattedEntry = `${dim}${key}:${reset} ${timeColor}${String(value)}ms${reset}`;
          } else if (typeof value === 'object') {
            formattedEntry = `${dim}${key}:${reset} ${JSON.stringify(
              value,
              null,
              2,
            ).replace(/\n/g, '\n      ')}`;
          } else {
            formattedEntry = `${dim}${key}:${reset} ${String(value)}`;
          }

          if (keyFields.includes(key)) {
            priorityEntries.push(formattedEntry);
          } else {
            otherEntries.push(formattedEntry);
          }
        });

      const allEntries = [...priorityEntries, ...otherEntries];
      if (allEntries.length > 0) {
        formattedMeta = `\n  ${allEntries.join('\n  ')}`;
      }
    }

    return `${formattedTime} ${formattedLevel} ${formattedMessage}${formattedMeta}`;
  }

  /**
   * 格式化文件日志输出 - 提供更好的可读性
   */
  private formatFileOutput(info: {
    timestamp?: string;
    level: string;
    message: unknown;
    [key: string]: any;
  }): string {
    const { timestamp, level, message, ...meta } = info;

    // 基础信息
    const baseInfo = {
      timestamp: timestamp || new Date().toISOString(),
      level: level.toUpperCase(),
      message: String(message),
    };

    // 提取关键字段
    const keyFields = [
      'requestId',
      'method',
      'url',
      'statusCode',
      'responseTime',
      'ip',
      'userId',
      'module',
      'logType',
    ];
    const keyMeta: Record<string, any> = {};
    const otherMeta: Record<string, any> = {};

    Object.entries(meta).forEach(([key, value]) => {
      if (keyFields.includes(key)) {
        keyMeta[key] = value as string | number | boolean | object;
      } else {
        otherMeta[key] = value as string | number | boolean | object;
      }
    });

    // 构建最终对象，关键字段在前
    const finalLog = {
      ...baseInfo,
      ...keyMeta,
      ...otherMeta,
    };

    return JSON.stringify(finalLog, null, 2);
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
    const baseFilePath = this.configService.get<string>(
      'logging.filePath',
      './logs',
    );

    // 获取当前日期的日志目录，如果LogManagementService可用的话
    const filePath = this.logManagementService
      ? this.logManagementService.getLogDirectoryPath()
      : baseFilePath;
    const maxFiles = this.configService.get<string>('logging.maxFiles', '14d');
    const maxFileSize = this.configService.get<string>(
      'logging.maxFileSize',
      '20mb',
    );

    // HTTP日志配置
    const enableHttpRequestFile = this.configService.get<boolean>(
      'logging.httpRequestLogging.enableRequestFile',
      false,
    );
    const baseHttpRequestFilePath = this.configService.get<string>(
      'logging.httpRequestLogging.requestFilePath',
      './logs/http-requests.log',
    );
    const enableHttpResponseFile = this.configService.get<boolean>(
      'logging.httpRequestLogging.enableResponseFile',
      false,
    );
    const baseHttpResponseFilePath = this.configService.get<string>(
      'logging.httpRequestLogging.responseFilePath',
      './logs/http-responses.log',
    );

    // 使用按日期分类的目录路径构建HTTP日志文件路径
    const httpRequestFilePath = this.logManagementService
      ? `${filePath}/http-requests.log`
      : baseHttpRequestFilePath;
    const httpResponseFilePath = this.logManagementService
      ? `${filePath}/http-responses.log`
      : baseHttpResponseFilePath;
    const httpMaxFiles = this.configService.get<string>(
      'logging.httpRequestLogging.maxFiles',
      '14',
    );
    const httpMaxFileSize = this.configService.get<string>(
      'logging.httpRequestLogging.maxFileSize',
      '20mb',
    );

    const transports: winston.transport[] = [];

    // 控制台输出 - 只有在明确启用或者文件日志未启用时才启用
    if (enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              return this.formatConsoleOutput(
                String(timestamp),
                String(level),
                String(message),
                meta,
              );
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
            winston.format.printf((info) => this.formatFileOutput(info)),
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
            winston.format.printf((info) => this.formatFileOutput(info)),
          ),
        }),
      );
    }

    // 存储HTTP日志配置供后续使用
    this.httpRequestFileConfig = enableHttpRequestFile
      ? {
          filePath: httpRequestFilePath,
          maxFiles: httpMaxFiles,
          maxSize: httpMaxFileSize,
        }
      : null;

    this.httpResponseFileConfig = enableHttpResponseFile
      ? {
          filePath: httpResponseFilePath,
          maxFiles: httpMaxFiles,
          maxSize: httpMaxFileSize,
        }
      : null;

    return winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
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
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json(),
              ),
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
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json(),
              ),
            }),
          ]
        : undefined,
    });
  }

  /**
   * 初始化HTTP日志器
   */
  private initializeHttpLoggers(): void {
    // 初始化HTTP请求日志器
    if (this.httpRequestFileConfig) {
      this.httpRequestLogger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.printf((info) => this.formatFileOutput(info)),
        ),
        transports: [
          new DailyRotateFile({
            filename: this.httpRequestFileConfig.filePath,
            maxFiles: this.httpRequestFileConfig.maxFiles,
            maxSize: this.httpRequestFileConfig.maxSize,
          }),
        ],
      });
    }

    // 初始化HTTP响应日志器
    if (this.httpResponseFileConfig) {
      this.httpResponseLogger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.printf((info) => this.formatFileOutput(info)),
        ),
        transports: [
          new DailyRotateFile({
            filename: this.httpResponseFileConfig.filePath,
            maxFiles: this.httpResponseFileConfig.maxFiles,
            maxSize: this.httpResponseFileConfig.maxSize,
          }),
        ],
      });
    }
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
      url: req.originalUrl || req.url,
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

  log(message: any, context?: any): void {
    setImmediate(() => {
      // 处理 NestJS 内置日志调用
      let logMessage: string;

      let logContext: Partial<LogContext> = {};

      if (typeof message === 'string') {
        logMessage = message;
        if (context && typeof context === 'object') {
          logContext = context as Record<string, unknown>;
        }
      } else if (typeof message === 'object' && message !== null) {
        // NestJS 有时会传递对象作为第一个参数

        const msgObj: Record<string, unknown> = message as Record<
          string,
          unknown
        >;
        if ('message' in msgObj && typeof msgObj.message === 'string') {
          logMessage = msgObj.message;
          const rest = { ...msgObj };
          delete rest.message;

          logContext = rest as Partial<LogContext>;
        } else {
          logMessage = JSON.stringify(message);
        }
      } else {
        logMessage = String(message);
      }

      this.logger.info(logMessage, { ...this.context, ...logContext });
    });
  }

  error(message: any, trace?: string, context?: any): void {
    // 错误日志保持同步，确保重要信息不丢失
    let logMessage: string;

    let logContext: Partial<LogContext> = {};

    if (typeof message === 'string') {
      logMessage = message;
      if (context && typeof context === 'object') {
        logContext = context as Record<string, unknown>;
      }
    } else if (typeof message === 'object' && message !== null) {
      const msgObj: Record<string, unknown> = message as Record<
        string,
        unknown
      >;
      if ('message' in msgObj && typeof msgObj.message === 'string') {
        logMessage = msgObj.message;
        const rest = { ...msgObj };
        delete rest.message;

        logContext = rest as Partial<LogContext>;
      } else {
        logMessage = JSON.stringify(message);
      }
    } else {
      logMessage = String(message);
    }

    this.logger.error(logMessage, {
      ...this.context,
      ...logContext,
      stack: trace ?? (message instanceof Error ? message.stack : undefined),
      logType: 'error',
    });
  }

  warn(message: any, context?: any): void {
    setImmediate(() => {
      let logMessage: string;
      let logContext: Partial<LogContext> = {};

      if (typeof message === 'string') {
        logMessage = message;
        if (context && typeof context === 'object') {
          logContext = context as Record<string, unknown>;
        }
      } else if (typeof message === 'object' && message !== null) {
        // NestJS 有时会传递对象作为第一个参数
        const msgObj: Record<string, unknown> = message as Record<
          string,
          unknown
        >;
        if ('message' in msgObj && typeof msgObj.message === 'string') {
          logMessage = msgObj.message;
          const rest = { ...msgObj };
          delete rest.message;
          logContext = rest as Partial<LogContext>;
        } else {
          logMessage = JSON.stringify(message);
        }
      } else {
        logMessage = String(message);
      }

      this.logger.warn(logMessage, {
        ...this.context,
        ...logContext,
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
   * 记录HTTP请求日志
   */
  httpRequest(message: string, data: any): void {
    if (this.httpRequestLogger) {
      this.httpRequestLogger.info(message, {
        ...data,
        ...this.context,
        logType: 'http_request',
      });
    }
    // 同时记录到主日志器
    this.log(message, { ...data, logType: 'http_request' });
  }

  /**
   * 记录HTTP响应日志
   */
  httpResponse(message: string, data: any): void {
    if (this.httpResponseLogger) {
      this.httpResponseLogger.info(message, {
        ...data,
        ...this.context,
        logType: 'http_response',
      });
    }
    // 同时记录到主日志器
    this.log(message, { ...data, logType: 'http_response' });
  }

  /**
   * 创建子日志器
   */
  child(context: Partial<LogContext>): StructuredLoggerService {
    const childLogger = new StructuredLoggerService(
      this.configService,
      this.logManagementService,
    );
    childLogger.setContext({ ...this.context, ...context });
    return childLogger;
  }
}
