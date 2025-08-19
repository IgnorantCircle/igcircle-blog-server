import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { StructuredLoggerService } from '../logger/structured-logger.service';
import { ConfigService } from '@nestjs/config';

/**
 * HTTP请求日志中间件
 * 记录用户端的所有HTTP请求，排除管理端和开发工具请求
 */
@Injectable()
export class HttpRequestLoggerMiddleware implements NestMiddleware {
  constructor(
    private readonly logger: StructuredLoggerService,
    private readonly configService: ConfigService,
  ) {
    this.logger.setContext({ module: 'HttpRequestLogger' });
  }

  use(req: Request, res: Response, next: NextFunction): void {
    // 添加调试日志
    this.logger.log(
      `[HttpRequestLoggerMiddleware] Processing request: ${req.method} ${req.path}`,
    );

    // 检查HTTP日志文件配置
    const enableHttpRequestFile = this.configService.get<boolean>(
      'logging.httpRequestLogging.enableRequestFile',
      false,
    );
    const enableHttpResponseFile = this.configService.get<boolean>(
      'logging.httpRequestLogging.enableResponseFile',
      false,
    );
    this.logger.log(
      `[HttpRequestLoggerMiddleware] HTTP Request File Enabled: ${enableHttpRequestFile}`,
    );
    this.logger.log(
      `[HttpRequestLoggerMiddleware] HTTP Response File Enabled: ${enableHttpResponseFile}`,
    );

    // 检查原始环境变量
    this.logger.log(
      `[HttpRequestLoggerMiddleware] LOG_ENABLE_HTTP_REQUEST_FILE: ${process.env.LOG_ENABLE_HTTP_REQUEST_FILE}`,
    );
    this.logger.log(
      `[HttpRequestLoggerMiddleware] LOG_ENABLE_HTTP_RESPONSE_FILE: ${process.env.LOG_ENABLE_HTTP_RESPONSE_FILE}`,
    );

    // 检查是否启用HTTP请求日志
    const isEnabled = this.configService.get<boolean>(
      'logging.httpRequestLogging.enabled',
      true,
    );

    this.logger.log(
      `[HttpRequestLoggerMiddleware] Enabled: ${isEnabled}, ShouldSkip: ${this.shouldSkipLogging(req.path)}`,
    );

    if (!isEnabled || this.shouldSkipLogging(req.path)) {
      return next();
    }

    const startTime = Date.now();
    const requestId = this.generateRequestId();

    // 设置请求上下文
    this.logger.setContextFromRequest(req);
    this.logger.setContext({ requestId });

    // 监听响应结束事件
    res.on('finish', () => {
      this.logRequest(req, res, startTime, requestId);
    });

    next();
  }

  /**
   * 判断是否应该跳过日志记录
   */
  private shouldSkipLogging(path: string): boolean {
    const defaultSkipPatterns = [
      '/api/admin/', // 管理端API
      '/api/dev/', // 开发工具API
      '/health', // 健康检查
      '/metrics', // 监控指标
      '/favicon.ico', // 静态资源
      '/robots.txt', // 爬虫文件
      '/.well-known/', // 公共资源
    ];

    // 从配置中获取额外的跳过路径
    const configSkipPaths = this.configService.get<string[]>(
      'logging.httpRequestLogging.skipPaths',
      [],
    );

    const allSkipPatterns = [...defaultSkipPatterns, ...configSkipPaths];

    return allSkipPatterns.some((pattern) => path.startsWith(pattern));
  }

  /**
   * 记录HTTP请求日志
   */
  private logRequest(
    req: Request,
    res: Response,
    startTime: number,
    requestId: string,
  ): void {
    const responseTime = Date.now() - startTime;
    const slowRequestThreshold = this.configService.get<number>(
      'logging.httpRequestLogging.slowRequestThreshold',
      1000,
    );
    const logSlowRequests = this.configService.get<boolean>(
      'logging.httpRequestLogging.logSlowRequests',
      true,
    );

    const logData = {
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      responseTime,
      ip: this.getClientIp(req),
      userAgent: req.get('User-Agent') || undefined,
      userId:
        (req as Request & { user?: { id: string } }).user?.id || undefined,
      referer: req.get('Referer') || undefined,
      contentLength: res.get('Content-Length') || undefined,
      logType: 'http_request',
      metadata: {
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        isSlowRequest: responseTime >= slowRequestThreshold,
      },
    };

    // 异步记录日志，避免阻塞请求
    setImmediate(() => {
      if (res.statusCode >= 500) {
        // 服务器错误 - 记录到错误日志和HTTP响应日志
        this.logger.error('HTTP请求服务器错误', undefined, logData);
        this.logger.httpResponse('HTTP响应服务器错误', logData);
      } else if (res.statusCode >= 400) {
        // 客户端错误 - 记录到警告日志和HTTP响应日志
        this.logger.warn('HTTP请求客户端错误', logData);
        this.logger.httpResponse('HTTP响应客户端错误', logData);
      } else if (logSlowRequests && responseTime >= slowRequestThreshold) {
        // 慢请求警告 - 记录到警告日志和HTTP请求日志
        const slowRequestData = {
          ...logData,
          metadata: {
            ...logData.metadata,
            slowRequestWarning: true,
          },
        };
        this.logger.warn('HTTP慢请求', slowRequestData);
        this.logger.httpRequest('HTTP慢请求', slowRequestData);
      } else {
        // 正常请求 - 记录到HTTP请求日志
        this.logger.httpRequest('HTTP请求', logData);
        // 正常响应 - 记录到HTTP响应日志
        this.logger.httpResponse('HTTP响应', logData);
      }
    });
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取客户端真实IP地址
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
}
