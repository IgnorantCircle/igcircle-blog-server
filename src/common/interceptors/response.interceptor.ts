import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ApiResponse } from '../interfaces/response.interface';
import { ResponseUtil } from '../utils/response.util';

/**
 * 响应拦截器 - 统一格式化成功响应
 */
@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.url;

    return next.handle().pipe(
      map((data): ApiResponse<T> => {
        // 如果返回的数据已经是标准格式，直接返回
        if (
          data &&
          typeof data === 'object' &&
          'code' in data &&
          'message' in data
        ) {
          return data as ApiResponse<T>;
        }

        // 根据HTTP状态码返回不同的响应格式
        const response = context.switchToHttp().getResponse<Response>();
        const statusCode = response.statusCode;

        switch (statusCode) {
          case 201:
            return ResponseUtil.created(
              data,
              '创建成功',
              path,
            ) as ApiResponse<T>;
          case 204:
            return ResponseUtil.noContent('操作成功', path) as ApiResponse<T>;
          default:
            return ResponseUtil.success(
              data,
              '操作成功',
              path,
            ) as ApiResponse<T>;
        }
      }),
    );
  }
}