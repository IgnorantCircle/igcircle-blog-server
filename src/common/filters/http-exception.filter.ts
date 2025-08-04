import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponse } from '@/common/interfaces/response.interface';

/**
 * 全局HTTP异常过滤器
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let error: string;
    let details: any[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as {
          message?: string | string[];
          error?: string;
          details?: any[];
        };
        message =
          typeof responseObj.message === 'string'
            ? responseObj.message
            : exception.message;
        error = responseObj.error || 'Http Exception';
        details = responseObj.details;

        // 处理验证错误
        if (Array.isArray(responseObj.message)) {
          message = '参数验证失败';
          details = responseObj.message;
        }
      } else {
        message = exceptionResponse.toString();
        error = 'Http Exception';
      }
    } else if (exception instanceof Error) {
      // 处理其他类型的错误
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = '服务器内部错误';
      error = exception.name || 'Internal Server Error';

      // 记录详细错误信息到日志
      this.logger.error(
        `Internal Server Error: ${exception.message}`,
        exception.stack,
        `${request.method} ${request.url}`,
      );
    } else {
      // 处理未知错误
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = '未知错误';
      error = 'Unknown Error';

      this.logger.error(
        `Unknown Error: ${JSON.stringify(exception)}`,
        undefined,
        `${request.method} ${request.url}`,
      );
    }

    // 构建错误响应
    const errorResponse: ErrorResponse = {
      code: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // 如果有验证错误详情，添加到响应中
    if (details) {
      errorResponse.details = details;
    }

    // 记录错误日志（非500错误记录为警告）
    if (status >= 500) {
      this.logger.error(
        `${status} ${message}`,
        exception instanceof Error ? exception.stack : undefined,
        `${request.method} ${request.url}`,
      );
    } else {
      this.logger.warn(
        `${status} ${message} - ${request.method} ${request.url}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
