export interface BaseCacheOptions {
  /** 缓存类型 */
  type?: string;
  /** 缓存时间（秒），默认300秒 */
  ttl?: number;
}

export interface CacheOptions extends BaseCacheOptions {
  /** 缓存键 */
  key?: string;
  /** 缓存类型 */
  type: string;
}

export interface CacheEvictOptions {
  /** 要清除的缓存类型 */
  type: string;
  /** 要清除的缓存键 */
  key?: string;
}
