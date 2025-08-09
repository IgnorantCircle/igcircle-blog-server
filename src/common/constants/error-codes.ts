/**
 * 错误码枚举
 * 格式：模块_错误类型_具体错误
 */
export enum ErrorCode {
  // 通用错误 (COMMON_xxx)
  COMMON_VALIDATION_FAILED = 'COMMON_001',
  COMMON_UNAUTHORIZED = 'COMMON_002',
  COMMON_FORBIDDEN = 'COMMON_003',
  COMMON_NOT_FOUND = 'COMMON_004',
  COMMON_CONFLICT = 'COMMON_005',
  COMMON_INTERNAL_ERROR = 'COMMON_006',
  COMMON_BAD_REQUEST = 'COMMON_007',
  COMMON_RATE_LIMIT_EXCEEDED = 'COMMON_008',

  // 用户相关错误 (USER_xxx)
  USER_NOT_FOUND = 'USER_001',
  USER_ALREADY_EXISTS = 'USER_002',
  USER_INVALID_CREDENTIALS = 'USER_003',
  USER_ACCOUNT_DISABLED = 'USER_004',
  USER_ACCOUNT_BANNED = 'USER_005',
  USER_EMAIL_NOT_VERIFIED = 'USER_006',
  USER_PASSWORD_TOO_WEAK = 'USER_007',
  USER_PROFILE_UPDATE_FAILED = 'USER_008',

  // 认证相关错误 (AUTH_xxx)
  AUTH_TOKEN_INVALID = 'AUTH_001',
  AUTH_TOKEN_EXPIRED = 'AUTH_002',
  AUTH_TOKEN_MISSING = 'AUTH_003',
  AUTH_LOGIN_FAILED = 'AUTH_004',
  AUTH_LOGOUT_FAILED = 'AUTH_005',
  AUTH_REFRESH_TOKEN_INVALID = 'AUTH_006',
  AUTH_VERIFICATION_CODE_INVALID = 'AUTH_007',
  AUTH_VERIFICATION_CODE_EXPIRED = 'AUTH_008',
  AUTH_RSA_DECRYPT_FAILED = 'AUTH_009',
  AUTH_PERMISSION_DENIED = 'AUTH_010',
  AUTH_USER_INFO_MISSING = 'AUTH_011',
  AUTH_FORCED_LOGOUT = 'AUTH_012',

  // 文章相关错误 (ARTICLE_xxx)
  ARTICLE_NOT_FOUND = 'ARTICLE_001',
  ARTICLE_SLUG_EXISTS = 'ARTICLE_002',
  ARTICLE_PUBLISH_FAILED = 'ARTICLE_003',
  ARTICLE_UPDATE_FAILED = 'ARTICLE_004',
  ARTICLE_DELETE_FAILED = 'ARTICLE_005',
  ARTICLE_INVALID_STATUS = 'ARTICLE_006',
  ARTICLE_ACCESS_DENIED = 'ARTICLE_007',
  ARTICLE_CONTENT_TOO_LONG = 'ARTICLE_008',

  // 分类相关错误 (CATEGORY_xxx)
  CATEGORY_NOT_FOUND = 'CATEGORY_001',
  CATEGORY_NAME_EXISTS = 'CATEGORY_002',
  CATEGORY_HAS_ARTICLES = 'CATEGORY_003',
  CATEGORY_INVALID_PARENT = 'CATEGORY_004',

  // 标签相关错误 (TAG_xxx)
  TAG_NOT_FOUND = 'TAG_001',
  TAG_NAME_EXISTS = 'TAG_002',
  TAG_IN_USE = 'TAG_003',

  // 评论相关错误 (COMMENT_xxx)
  COMMENT_NOT_FOUND = 'COMMENT_001',
  COMMENT_ARTICLE_NOT_FOUND = 'COMMENT_002',
  COMMENT_PARENT_NOT_FOUND = 'COMMENT_003',
  COMMENT_ACCESS_DENIED = 'COMMENT_004',
  COMMENT_CONTENT_INVALID = 'COMMENT_005',
  COMMENT_DISABLED = 'COMMENT_006',
  COMMENT_SPAM_DETECTED = 'COMMENT_007',

  // 文件相关错误 (FILE_xxx)
  FILE_NOT_FOUND = 'FILE_001',
  FILE_TOO_LARGE = 'FILE_002',
  FILE_INVALID_TYPE = 'FILE_003',
  FILE_UPLOAD_FAILED = 'FILE_004',
  FILE_DELETE_FAILED = 'FILE_005',

  // 邮件相关错误 (EMAIL_xxx)
  EMAIL_SEND_FAILED = 'EMAIL_001',
  EMAIL_TEMPLATE_NOT_FOUND = 'EMAIL_002',
  EMAIL_INVALID_ADDRESS = 'EMAIL_003',

  // 缓存相关错误 (CACHE_xxx)
  CACHE_CONNECTION_FAILED = 'CACHE_001',
  CACHE_SET_FAILED = 'CACHE_002',
  CACHE_GET_FAILED = 'CACHE_003',
  CACHE_DELETE_FAILED = 'CACHE_004',

  // 数据库相关错误 (DB_xxx)
  DB_CONNECTION_FAILED = 'DB_001',
  DB_QUERY_FAILED = 'DB_002',
  DB_TRANSACTION_FAILED = 'DB_003',
  DB_CONSTRAINT_VIOLATION = 'DB_004',
}

/**
 * 错误信息映射
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  // 通用错误
  [ErrorCode.COMMON_VALIDATION_FAILED]: '参数验证失败',
  [ErrorCode.COMMON_UNAUTHORIZED]: '未授权访问',
  [ErrorCode.COMMON_FORBIDDEN]: '权限不足',
  [ErrorCode.COMMON_NOT_FOUND]: '资源不存在',
  [ErrorCode.COMMON_CONFLICT]: '资源冲突',
  [ErrorCode.COMMON_INTERNAL_ERROR]: '服务器内部错误',
  [ErrorCode.COMMON_BAD_REQUEST]: '请求参数错误',
  [ErrorCode.COMMON_RATE_LIMIT_EXCEEDED]: '请求过于频繁',

  // 用户相关错误
  [ErrorCode.USER_NOT_FOUND]: '用户不存在',
  [ErrorCode.USER_ALREADY_EXISTS]: '用户已存在',
  [ErrorCode.USER_INVALID_CREDENTIALS]: '用户名或密码错误',
  [ErrorCode.USER_ACCOUNT_DISABLED]: '账户已禁用',
  [ErrorCode.USER_ACCOUNT_BANNED]: '账户已被封禁',
  [ErrorCode.USER_EMAIL_NOT_VERIFIED]: '邮箱未验证',
  [ErrorCode.USER_PASSWORD_TOO_WEAK]: '密码强度不足',
  [ErrorCode.USER_PROFILE_UPDATE_FAILED]: '用户资料更新失败',

  // 认证相关错误
  [ErrorCode.AUTH_TOKEN_INVALID]: '访问令牌无效',
  [ErrorCode.AUTH_TOKEN_EXPIRED]: '访问令牌已过期',
  [ErrorCode.AUTH_TOKEN_MISSING]: '访问令牌缺失',
  [ErrorCode.AUTH_LOGIN_FAILED]: '登录失败',
  [ErrorCode.AUTH_LOGOUT_FAILED]: '退出登录失败',
  [ErrorCode.AUTH_REFRESH_TOKEN_INVALID]: '刷新令牌无效',
  [ErrorCode.AUTH_VERIFICATION_CODE_INVALID]: '验证码无效',
  [ErrorCode.AUTH_VERIFICATION_CODE_EXPIRED]: '验证码已过期',
  [ErrorCode.AUTH_RSA_DECRYPT_FAILED]: 'RSA解密失败',
  [ErrorCode.AUTH_PERMISSION_DENIED]: '权限不足',
  [ErrorCode.AUTH_USER_INFO_MISSING]: '用户信息缺失',
  [ErrorCode.AUTH_FORCED_LOGOUT]: '强制退出登录',

  // 文章相关错误
  [ErrorCode.ARTICLE_NOT_FOUND]: '文章不存在',
  [ErrorCode.ARTICLE_SLUG_EXISTS]: '文章别名已存在',
  [ErrorCode.ARTICLE_PUBLISH_FAILED]: '文章发布失败',
  [ErrorCode.ARTICLE_UPDATE_FAILED]: '文章更新失败',
  [ErrorCode.ARTICLE_DELETE_FAILED]: '文章删除失败',
  [ErrorCode.ARTICLE_INVALID_STATUS]: '文章状态无效',
  [ErrorCode.ARTICLE_ACCESS_DENIED]: '无权访问此文章',
  [ErrorCode.ARTICLE_CONTENT_TOO_LONG]: '文章内容过长',

  // 分类相关错误
  [ErrorCode.CATEGORY_NOT_FOUND]: '分类不存在',
  [ErrorCode.CATEGORY_NAME_EXISTS]: '分类名称已存在',
  [ErrorCode.CATEGORY_HAS_ARTICLES]: '分类下还有文章，无法删除',
  [ErrorCode.CATEGORY_INVALID_PARENT]: '无效的父分类',

  // 标签相关错误
  [ErrorCode.TAG_NOT_FOUND]: '标签不存在',
  [ErrorCode.TAG_NAME_EXISTS]: '标签名称已存在',
  [ErrorCode.TAG_IN_USE]: '标签正在使用中，无法删除',

  // 评论相关错误
  [ErrorCode.COMMENT_NOT_FOUND]: '评论不存在',
  [ErrorCode.COMMENT_ARTICLE_NOT_FOUND]: '评论的文章不存在',
  [ErrorCode.COMMENT_PARENT_NOT_FOUND]: '父评论不存在',
  [ErrorCode.COMMENT_ACCESS_DENIED]: '无权访问此评论',
  [ErrorCode.COMMENT_CONTENT_INVALID]: '评论内容无效',
  [ErrorCode.COMMENT_DISABLED]: '评论功能已禁用',
  [ErrorCode.COMMENT_SPAM_DETECTED]: '检测到垃圾评论',

  // 文件相关错误
  [ErrorCode.FILE_NOT_FOUND]: '文件不存在',
  [ErrorCode.FILE_TOO_LARGE]: '文件过大',
  [ErrorCode.FILE_INVALID_TYPE]: '文件类型不支持',
  [ErrorCode.FILE_UPLOAD_FAILED]: '文件上传失败',
  [ErrorCode.FILE_DELETE_FAILED]: '文件删除失败',

  // 邮件相关错误
  [ErrorCode.EMAIL_SEND_FAILED]: '邮件发送失败',
  [ErrorCode.EMAIL_TEMPLATE_NOT_FOUND]: '邮件模板不存在',
  [ErrorCode.EMAIL_INVALID_ADDRESS]: '邮箱地址无效',

  // 缓存相关错误
  [ErrorCode.CACHE_CONNECTION_FAILED]: '缓存连接失败',
  [ErrorCode.CACHE_SET_FAILED]: '缓存设置失败',
  [ErrorCode.CACHE_GET_FAILED]: '缓存获取失败',
  [ErrorCode.CACHE_DELETE_FAILED]: '缓存删除失败',

  // 数据库相关错误
  [ErrorCode.DB_CONNECTION_FAILED]: '数据库连接失败',
  [ErrorCode.DB_QUERY_FAILED]: '数据库查询失败',
  [ErrorCode.DB_TRANSACTION_FAILED]: '数据库事务失败',
  [ErrorCode.DB_CONSTRAINT_VIOLATION]: '数据库约束违反',
};

/**
 * 获取错误信息
 */
export function getErrorMessage(code: ErrorCode): string {
  return ErrorMessages[code] || '未知错误';
}
