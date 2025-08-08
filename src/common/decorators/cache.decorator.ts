import { SetMetadata, applyDecorators } from '@nestjs/common';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CACHE_KEY = 'cache';
export const CACHE_TTL_KEY = 'cache_ttl';
export const CACHE_TYPE_KEY = 'cache_type';
export const CACHE_TAGS_KEY = 'cache_tags';

export interface CacheDecoratorOptions {
  /** 缓存键，支持模板变量 */
  key?: string;
  /** 缓存类型 */
  type: string;
  /** 缓存时间（秒） */
  ttl?: number;
  /** 缓存标签 */
  tags?: string[];
  /** 是否启用缓存 */
  enabled?: boolean;
  /** 缓存键生成函数 */
  keyGenerator?: (...args: any[]) => string;
}

/**
 * 缓存装饰器
 * 自动缓存方法的返回值
 */
export function Cache(options: CacheDecoratorOptions) {
  return applyDecorators(
    SetMetadata(CACHE_KEY, options.key || 'auto'),
    SetMetadata(CACHE_TTL_KEY, options.ttl || 300),
    SetMetadata(CACHE_TYPE_KEY, options.type),
    SetMetadata(CACHE_TAGS_KEY, options.tags || []),
    SetMetadata('cache_options', options),
  );
}

/**
 * 缓存失效装饰器
 * 在方法执行后自动清除相关缓存
 */
export function CacheEvict(options: {
  /** 要清除的缓存标签 */
  tags?: string[];
  /** 要清除的缓存键模式 */
  patterns?: string[];
  /** 要清除的缓存类型 */
  types?: string[];
  /** 是否清除所有缓存 */
  allEntries?: boolean;
}) {
  return SetMetadata('cache_evict', options);
}

/**
 * 缓存更新装饰器
 * 在方法执行后更新缓存
 */
export function CachePut(options: CacheDecoratorOptions) {
  return SetMetadata('cache_put', options);
}

/**
 * 条件缓存装饰器
 * 根据条件决定是否缓存
 */
export function CacheConditional(condition: (...args: any[]) => boolean) {
  return SetMetadata('cache_condition', condition);
}

/**
 * 获取缓存键参数装饰器
 * 用于从方法参数中提取缓存键
 */
export const CacheKey = createParamDecorator(
  (keyPath: string, ctx: ExecutionContext) => {
    const args = ctx.getArgs();

    if (keyPath) {
      // 从指定路径提取值
      const keys = keyPath.split('.');
      let value = args[0]; // 默认从第一个参数开始

      for (const key of keys) {
        if (value && typeof value === 'object') {
          value = value[key];
        } else {
          return null;
        }
      }

      return value;
    }

    // 返回所有参数
    return args;
  },
);

/**
 * 缓存预热装饰器
 * 在应用启动时预热缓存
 */
export function CacheWarmup(options: {
  /** 预热的缓存类型 */
  type: string;
  /** 预热优先级 */
  priority?: number;
  /** 预热条件 */
  condition?: () => boolean;
}) {
  return SetMetadata('cache_warmup', options);
}

/**
 * 缓存监控装饰器
 * 监控缓存的命中率和性能
 */
export function CacheMonitor(options?: {
  /** 是否记录缓存命中率 */
  trackHitRate?: boolean;
  /** 是否记录执行时间 */
  trackExecutionTime?: boolean;
  /** 监控标签 */
  tags?: string[];
}) {
  return SetMetadata('cache_monitor', options || {});
}

/**
 * 缓存锁装饰器
 * 防止缓存击穿，同一时间只允许一个请求更新缓存
 */
export function CacheLock(options?: {
  /** 锁的超时时间（毫秒） */
  timeout?: number;
  /** 锁的键前缀 */
  keyPrefix?: string;
}) {
  return SetMetadata('cache_lock', options || {});
}

/**
 * 缓存降级装饰器
 * 当缓存不可用时的降级策略
 */
export function CacheFallback(fallbackStrategy: 'skip' | 'error' | 'default') {
  return SetMetadata('cache_fallback', fallbackStrategy);
}
