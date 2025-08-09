import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import {
  ApiResponse,
  PaginatedResponse,
} from '@/common/interfaces/response.interface';
import { PaginationUtil } from '@/common/utils/pagination.util';

/**
 * 响应拦截器 - 统一格式化成功响应
 */
@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<any>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const path = request.url;

    return next.handle().pipe(
      map((data): ApiResponse<T> => {
        // 如果返回的数据已经是标准格式，直接返回
        if (this.isApiResponse(data)) {
          return data;
        }

        // 处理分页数据
        if (this.isPaginatedData(data)) {
          return this.formatPaginatedResponse(
            data,
            path,
            response.statusCode,
          ) as ApiResponse<T>;
        }

        // 处理普通数据
        return this.formatResponse(data as T, path, response.statusCode);
      }),
    );
  }

  private isApiResponse(data: unknown): data is ApiResponse<T> {
    return Boolean(
      data &&
        typeof data === 'object' &&
        'code' in data &&
        'message' in data &&
        'timestamp' in data,
    );
  }

  private isPaginatedData(data: unknown): data is {
    items: unknown[];
    total: number;
    page?: number;
    limit?: number;
  } {
    return Boolean(
      data &&
        typeof data === 'object' &&
        'items' in data &&
        'total' in data &&
        Array.isArray((data as { items: unknown[] }).items),
    );
  }

  private formatPaginatedResponse(
    data: { items: unknown[]; total: number; page?: number; limit?: number },
    path: string,
    statusCode: number,
  ): ApiResponse<PaginatedResponse<unknown>> {
    const { items, total, page = 1, limit = 10 } = data;
    const paginatedData = PaginationUtil.buildPaginatedResponse(
      items,
      total,
      page,
      limit,
    );

    return {
      code: statusCode,
      message: this.getDefaultMessage(statusCode),
      data: paginatedData,
      timestamp: new Date().toISOString(),
      path,
    } as ApiResponse<PaginatedResponse<any>>;
  }

  private formatResponse(
    data: T,
    path: string,
    statusCode: number,
  ): ApiResponse<T> {
    return {
      code: statusCode,
      message: this.getDefaultMessage(statusCode),
      data,
      timestamp: new Date().toISOString(),
      path,
    };
  }

  private getDefaultMessage(statusCode: number): string {
    switch (statusCode) {
      case 200:
        return '操作成功';
      case 201:
        return '创建成功';
      case 204:
        return '操作成功';
      default:
        return '操作成功';
    }
  }
}
