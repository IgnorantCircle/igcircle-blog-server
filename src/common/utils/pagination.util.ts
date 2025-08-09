import { PaginatedResponse } from '@/common/interfaces/response.interface';

/**
 * 分页响应构建工具类
 */
export class PaginationUtil {
  /**
   * 构建分页响应数据
   * @param items 数据列表
   * @param total 总数量
   * @param page 当前页码
   * @param limit 每页数量
   * @returns 分页响应数据
   */
  static buildPaginatedResponse<T>(
    items: T[],
    total: number,
    page: number = 1,
    limit: number = 10,
  ): PaginatedResponse<T> {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNext,
      hasPrev,
    };
  }

  /**
   * 从查询结果构建分页响应
   * @param queryResult 包含items和total的查询结果
   * @param page 当前页码
   * @param limit 每页数量
   * @returns 分页响应数据
   */
  static fromQueryResult<T>(
    queryResult: { items: T[]; total: number },
    page: number = 1,
    limit: number = 10,
  ): PaginatedResponse<T> {
    return this.buildPaginatedResponse(
      queryResult.items,
      queryResult.total,
      page,
      limit,
    );
  }

  /**
   * 从TypeORM查询结果构建分页响应
   * @param items 数据列表
   * @param total 总数量
   * @param page 当前页码
   * @param limit 每页数量
   * @returns 分页响应数据
   */
  static fromTypeOrmResult<T>(
    [items, total]: [T[], number],
    page: number = 1,
    limit: number = 10,
  ): PaginatedResponse<T> {
    return this.buildPaginatedResponse(items, total, page, limit);
  }

  /**
   * 计算跳过的记录数
   * @param page 页码
   * @param limit 每页数量
   * @returns 跳过的记录数
   */
  static calculateSkip(page: number = 1, limit: number = 10): number {
    return (page - 1) * limit;
  }

  /**
   * 验证并规范化分页参数
   * @param page 页码
   * @param limit 每页数量
   * @param maxLimit 最大每页数量
   * @returns 规范化后的分页参数
   */
  static normalizePaginationParams(
    page: number = 1,
    limit: number = 10,
    maxLimit: number = 100,
  ): { page: number; limit: number } {
    const normalizedPage = Math.max(1, Math.floor(page));
    const normalizedLimit = Math.min(Math.max(1, Math.floor(limit)), maxLimit);

    return {
      page: normalizedPage,
      limit: normalizedLimit,
    };
  }
}
