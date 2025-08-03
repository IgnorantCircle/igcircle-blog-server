/**
 * 统一响应数据格式接口
 */
export interface ApiResponse<T = any> {
  /** 状态码 */
  code: number;
  /** 响应消息 */
  message: string;
  /** 响应数据 */
  data?: T;
  /** 时间戳 */
  timestamp: string;
  /** 请求路径 */
  path: string;
}

/**
 * 分页响应数据格式接口
 */
export interface PaginatedResponse<T = any> {
  /** 数据列表 */
  items: T[];
  /** 总数量 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页数量 */
  limit: number;
  /** 总页数 */
  totalPages: number;
  /** 是否有下一页 */
  hasNext: boolean;
  /** 是否有上一页 */
  hasPrev: boolean;
}

/**
 * 错误响应数据格式接口
 */
export interface ErrorResponse {
  /** 错误状态码 */
  code: number;
  /** 错误消息 */
  message: string;
  /** 错误详情 */
  error?: string;
  /** 验证错误详情 */
  details?: any[];
  /** 时间戳 */
  timestamp: string;
  /** 请求路径 */
  path: string;
}
