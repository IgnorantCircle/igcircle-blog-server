/**
 * 验证规则常量
 * 统一管理所有DTO的验证规则，确保一致性
 */

// 字符串长度限制
export const VALIDATION_LIMITS = {
  // 用户相关
  USERNAME: {
    MIN: 3,
    MAX: 20,
  },
  PASSWORD: {
    MIN: 6,
    MAX: 255,
  },
  NICKNAME: {
    MIN: 1,
    MAX: 50,
  },
  BIO: {
    MAX: 500,
  },

  // 通用字段
  NAME: {
    MIN: 1,
    MAX: 100,
  },
  DESCRIPTION: {
    MAX: 500,
  },
  SLUG: {
    MAX: 200,
  },

  // 文章相关
  ARTICLE_TITLE: {
    MIN: 1,
    MAX: 200,
  },
  ARTICLE_SUMMARY: {
    MAX: 500,
  },
  ARTICLE_CONTENT: {
    MAX: 1000000, // 1MB
  },

  // SEO相关
  SEO_TITLE: {
    MAX: 60,
  },
  SEO_DESCRIPTION: {
    MAX: 160,
  },
  SEO_KEYWORDS: {
    MAX: 255,
  },

  // 分类相关
  CATEGORY_NAME: {
    MIN: 1,
    MAX: 50,
  },

  // 标签相关
  TAG_NAME: {
    MIN: 1,
    MAX: 30,
  },

  // 评论相关
  COMMENT_CONTENT: {
    MIN: 1,
    MAX: 1000,
  },
  ADMIN_NOTE: {
    MAX: 500,
  },

  // 搜索相关
  SEARCH_KEYWORD: {
    MIN: 1,
    MAX: 100,
  },

  // 验证码
  VERIFICATION_CODE: {
    MIN: 6,
    MAX: 6,
  },
};

// 数组长度限制
export const ARRAY_LIMITS = {
  TAGS: {
    MAX: 10,
  },
  CATEGORIES: {
    MAX: 5,
  },
};

// 数值范围限制
export const NUMBER_LIMITS = {
  WEIGHT: {
    MIN: 0,
    MAX: 999,
  },
  READING_TIME: {
    MIN: 0,
    MAX: 999,
  },
  YEAR: {
    MIN: 1900,
    MAX: 2100,
  },
  MONTH: {
    MIN: 1,
    MAX: 12,
  },
  PAGE: {
    MIN: 1,
    MAX: 1000,
  },
  LIMIT: {
    MIN: 1,
    MAX: 100,
  },
  SEARCH_LIMIT: {
    MIN: 1,
    MAX: 50,
  },
  HEAT: {
    MIN: 0,
    MAX: 999,
  },
  DAYS: {
    MIN: 1,
    MAX: 365,
  },
} as const;

// 错误消息模板
export const VALIDATION_MESSAGES = {
  // 通用验证消息
  REQUIRED: (field: string) => `${field}不能为空`,
  MIN_LENGTH: (field: string, min: number) => `${field}至少${min}个字符`,
  MAX_LENGTH: (field: string, max: number) => `${field}最多${max}个字符`,
  EXACT_LENGTH: (field: string, length: number) => `${field}必须是${length}位`,
  INVALID_UUID: (field: string) => `${field}必须是有效的UUID`,
  INVALID_EMAIL: '请输入有效的邮箱地址',
  INVALID_DATE: '必须是有效的日期字符串',
  INVALID_BOOLEAN: (field: string) => `${field}必须是布尔值`,
  INVALID_NUMBER: (field: string) => `${field}必须是数字`,
  INVALID_URL: (field: string) => `${field}必须是有效的URL`,
  INVALID_ENUM: (field: string) => `${field}值无效`,
  INVALID_HEX_COLOR: '颜色必须是有效的十六进制颜色值',

  // 范围消息
  MIN_VALUE: (field: string, min: number) => `${field}不能小于${min}`,
  MAX_VALUE: (field: string, max: number) => `${field}不能超过${max}`,

  // 数组消息
  ARRAY_MAX_SIZE: (field: string, max: number) =>
    `${field}数量不能超过${max}个`,

  // 特定字段消息
  USERNAME_LENGTH: `用户名长度必须在${VALIDATION_LIMITS.USERNAME.MIN}-${VALIDATION_LIMITS.USERNAME.MAX}个字符之间`,
  PASSWORD_LENGTH: `密码长度必须在${VALIDATION_LIMITS.PASSWORD.MIN}-${VALIDATION_LIMITS.PASSWORD.MAX}个字符之间`,
  VERIFICATION_CODE_LENGTH: `验证码必须是${VALIDATION_LIMITS.VERIFICATION_CODE.MIN}位数字`,
};
