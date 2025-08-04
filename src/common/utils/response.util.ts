import {
  ApiResponse,
  PaginatedResponse,
} from '@/common/interfaces/response.interface';

/**
 * 响应工具类
 */
export class ResponseUtil {
  /**
   * 成功响应
   * @param data 响应数据
   * @param message 响应消息
   * @param path 请求路径
   * @returns 格式化的成功响应
   */
  static success<T>(
    data?: T,
    message: string = '操作成功',
    path: string = '',
  ): ApiResponse<T> {
    return {
      code: 200,
      message,
      data,
      timestamp: new Date().toISOString(),
      path,
    };
  }

  /**
   * 分页响应
   * @param items 数据列表
   * @param total 总数量
   * @param page 当前页码
   * @param limit 每页数量
   * @param message 响应消息
   * @param path 请求路径
   * @returns 格式化的分页响应
   */
  static paginated<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
    message: string = '查询成功',
    path: string = '',
  ): ApiResponse<PaginatedResponse<T>> {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      code: 200,
      message,
      data: {
        items,
        total,
        page,
        limit,
        totalPages,
        hasNext,
        hasPrev,
      },
      timestamp: new Date().toISOString(),
      path,
    };
  }

  /**
   * 创建响应
   * @param data 响应数据
   * @param message 响应消息
   * @param path 请求路径
   * @returns 格式化的创建响应
   */
  static created<T>(
    data?: T,
    message: string = '创建成功',
    path: string = '',
  ): ApiResponse<T> {
    return {
      code: 201,
      message,
      data,
      timestamp: new Date().toISOString(),
      path,
    };
  }

  /**
   * 无内容响应
   * @param message 响应消息
   * @param path 请求路径
   * @returns 格式化的无内容响应
   */
  static noContent(
    message: string = '操作成功',
    path: string = '',
  ): ApiResponse<null> {
    return {
      code: 204,
      message,
      data: null,
      timestamp: new Date().toISOString(),
      path,
    };
  }
}
