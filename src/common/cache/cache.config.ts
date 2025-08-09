/**
 * 简化的缓存配置
 * 统一TTL设置和键命名规则
 */

// 缓存类型定义
export const CACHE_TYPES = {
  USER: 'user',
  ARTICLE: 'article',
  CATEGORY: 'category',
  TAG: 'tag',
  COMMENT: 'comment',
  STATS: 'stats',
  TEMP: 'temp',
} as const;

export type CacheType = (typeof CACHE_TYPES)[keyof typeof CACHE_TYPES];

// 优化的TTL配置（秒）
export const CACHE_TTL = {
  USER: 600, // 10分钟 - 用户信息
  ARTICLE: 300, // 5分钟 - 文章内容
  CATEGORY: 1800, // 30分钟 - 分类（相对稳定）
  TAG: 1800, // 30分钟 - 标签（相对稳定）
  COMMENT: 300, // 5分钟 - 评论
  STATS: 900, // 15分钟 - 统计数据
  TEMP: 60, // 1分钟 - 临时数据
} as const;

// 缓存类型与TTL的映射
export const CACHE_TYPE_TTL_MAP: Record<CacheType, number> = {
  [CACHE_TYPES.USER]: CACHE_TTL.USER,
  [CACHE_TYPES.ARTICLE]: CACHE_TTL.ARTICLE,
  [CACHE_TYPES.CATEGORY]: CACHE_TTL.CATEGORY,
  [CACHE_TYPES.TAG]: CACHE_TTL.TAG,
  [CACHE_TYPES.COMMENT]: CACHE_TTL.COMMENT,
  [CACHE_TYPES.STATS]: CACHE_TTL.STATS,
  [CACHE_TYPES.TEMP]: CACHE_TTL.TEMP,
};

/**
 * 获取缓存类型的默认TTL
 */
export function getCacheTTL(type: CacheType, customTtl?: number): number {
  return customTtl || CACHE_TYPE_TTL_MAP[type] || CACHE_TTL.TEMP;
}

/**
 * 构建标准化的缓存键
 */
export function buildCacheKey(type: CacheType, key: string): string {
  return `blog:${type}:${key}`;
}
