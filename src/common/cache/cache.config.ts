import { CacheModuleOptions } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';
import { Cluster } from 'ioredis';

/**
 * 缓存配置接口
 */
export interface CacheConfig {
  /** 缓存类型 */
  type: string;
  /** 缓存前缀 */
  prefix: string;
  /** 默认TTL（秒） */
  ttl: number;
  /** 缓存标签 */
  tags: string[];
  /** 是否启用 */
  enabled: boolean;
  /** 最大缓存大小 */
  maxSize?: number;
  /** 压缩阈值（字节） */
  compressionThreshold?: number;
}

/**
 * 缓存策略配置
 */
export interface CacheStrategyConfig {
  /** 默认TTL */
  defaultTtl: number;
  /** 最大TTL */
  maxTtl: number;
  /** 缓存键前缀 */
  keyPrefix: string;
  /** 是否启用压缩 */
  enableCompression: boolean;
  /** 压缩阈值 */
  compressionThreshold: number;
  /** 是否启用监控 */
  enableMonitoring: boolean;
  /** 监控采样率 */
  monitoringSampleRate: number;
  /** 缓存预热配置 */
  warmup: {
    enabled: boolean;
    batchSize: number;
    concurrency: number;
  };
  /** 缓存清理配置 */
  cleanup: {
    enabled: boolean;
    interval: number; // 毫秒
    maxAge: number; // 秒
  };
}

/**
 * 默认缓存配置
 */
export const DEFAULT_CACHE_CONFIGS: Record<string, CacheConfig> = {
  user: {
    type: 'user',
    prefix: 'user',
    ttl: 1800, // 30分钟
    tags: ['user', 'auth'],
    enabled: true,
    maxSize: 10000,
    compressionThreshold: 1024,
  },
  article: {
    type: 'article',
    prefix: 'article',
    ttl: 3600, // 1小时
    tags: ['article', 'content'],
    enabled: true,
    maxSize: 5000,
    compressionThreshold: 2048,
  },
  category: {
    type: 'category',
    prefix: 'category',
    ttl: 7200, // 2小时
    tags: ['category', 'content'],
    enabled: true,
    maxSize: 1000,
    compressionThreshold: 512,
  },
  tag: {
    type: 'tag',
    prefix: 'tag',
    ttl: 7200, // 2小时
    tags: ['tag', 'content'],
    enabled: true,
    maxSize: 2000,
    compressionThreshold: 512,
  },
  comment: {
    type: 'comment',
    prefix: 'comment',
    ttl: 3600, // 1小时
    tags: ['comment', 'content'],
    enabled: true,
    maxSize: 20000,
    compressionThreshold: 1024,
  },
  stats: {
    type: 'stats',
    prefix: 'stats',
    ttl: 300, // 5分钟
    tags: ['stats', 'analytics'],
    enabled: true,
    maxSize: 500,
    compressionThreshold: 256,
  },
  search: {
    type: 'search',
    prefix: 'search',
    ttl: 1800, // 30分钟
    tags: ['search', 'query'],
    enabled: true,
    maxSize: 5000,
    compressionThreshold: 1024,
  },
  session: {
    type: 'session',
    prefix: 'session',
    ttl: 86400, // 24小时
    tags: ['session', 'auth'],
    enabled: true,
    maxSize: 10000,
    compressionThreshold: 512,
  },
  ratelimit: {
    type: 'ratelimit',
    prefix: 'ratelimit',
    ttl: 3600, // 1小时
    tags: ['ratelimit', 'security'],
    enabled: true,
    maxSize: 50000,
    compressionThreshold: 128,
  },
  lock: {
    type: 'lock',
    prefix: 'lock',
    ttl: 30, // 30秒
    tags: ['lock', 'system'],
    enabled: true,
    maxSize: 1000,
    compressionThreshold: 64,
  },
};

/**
 * 默认缓存策略配置
 */
export const DEFAULT_CACHE_STRATEGY: CacheStrategyConfig = {
  defaultTtl: 3600, // 1小时
  maxTtl: 86400, // 24小时
  keyPrefix: 'blog',
  enableCompression: true,
  compressionThreshold: 1024, // 1KB
  enableMonitoring: true,
  monitoringSampleRate: 0.1, // 10%
  warmup: {
    enabled: true,
    batchSize: 100,
    concurrency: 5,
  },
  cleanup: {
    enabled: true,
    interval: 300000, // 5分钟
    maxAge: 86400, // 24小时
  },
};

/**
 * 创建Redis缓存配置
 */
export const createRedisCacheConfig = (
  configService: ConfigService,
): CacheModuleOptions => {
  const redisConfig = {
    host: configService.get<string>('REDIS_HOST', 'localhost'),
    port: configService.get<number>('REDIS_PORT', 6379),
    password: configService.get<string>('REDIS_PASSWORD'),
    db: configService.get<number>('REDIS_DB', 0),
    keyPrefix: configService.get<string>('REDIS_KEY_PREFIX', 'blog:'),
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    keepAlive: 30000,
    family: 4,
    connectTimeout: 10000,
    commandTimeout: 5000,
  };

  // 检查是否使用集群模式
  const clusterNodes = configService.get<string>('REDIS_CLUSTER_NODES');

  if (clusterNodes) {
    // Redis 集群配置
    const nodes = clusterNodes.split(',').map((node) => {
      const [host, port] = node.trim().split(':');
      return { host, port: parseInt(port, 10) };
    });

    return {
      store: redisStore as any,
      redisInstance: new Cluster(nodes, {
        redisOptions: redisConfig,
        enableOfflineQueue: false,
        retryDelayOnFailover: 100,
      }),
      ttl: configService.get<number>('CACHE_TTL', 86400), // 24小时
      max: configService.get<number>('CACHE_MAX_ITEMS', 100000),
    };
  }

  // 单节点Redis配置
  return {
    store: redisStore as any,
    redisInstance: redisConfig,
    ttl: configService.get<number>('CACHE_TTL', 86400), // 24小时
    max: configService.get<number>('CACHE_MAX_ITEMS', 100000),
  };
};

/**
 * 缓存环境配置
 */
export interface CacheEnvironmentConfig {
  /** 开发环境配置 */
  development: Partial<CacheStrategyConfig>;
  /** 测试环境配置 */
  test: Partial<CacheStrategyConfig>;
  /** 生产环境配置 */
  production: Partial<CacheStrategyConfig>;
}

/**
 * 环境特定的缓存配置
 */
export const ENVIRONMENT_CACHE_CONFIGS: CacheEnvironmentConfig = {
  development: {
    enableMonitoring: true,
    monitoringSampleRate: 1.0, // 100% 监控
    warmup: {
      enabled: false,
      batchSize: 10,
      concurrency: 1,
    },
    cleanup: {
      enabled: false,
      interval: 60000, // 1分钟
      maxAge: 3600, // 1小时
    },
  },
  test: {
    defaultTtl: 60, // 1分钟
    maxTtl: 300, // 5分钟
    enableMonitoring: false,
    enableCompression: false,
    warmup: {
      enabled: false,
      batchSize: 5,
      concurrency: 1,
    },
    cleanup: {
      enabled: false,
      interval: 30000, // 30秒
      maxAge: 300, // 5分钟
    },
  },
  production: {
    enableMonitoring: true,
    monitoringSampleRate: 0.01, // 1% 监控
    warmup: {
      enabled: true,
      batchSize: 500,
      concurrency: 10,
    },
    cleanup: {
      enabled: true,
      interval: 600000, // 10分钟
      maxAge: 172800, // 48小时
    },
  },
};

/**
 * 获取环境特定的缓存配置
 */
export function getEnvironmentCacheConfig(
  environment: string = 'development',
): CacheStrategyConfig {
  const envConfig =
    ENVIRONMENT_CACHE_CONFIGS[environment as keyof CacheEnvironmentConfig] ||
    ENVIRONMENT_CACHE_CONFIGS.development;

  return {
    ...DEFAULT_CACHE_STRATEGY,
    ...envConfig,
  };
}

/**
 * 验证缓存配置
 */
export function validateCacheConfig(config: Partial<CacheConfig>): boolean {
  if (!config.type || !config.prefix) {
    return false;
  }

  if (config.ttl && (config.ttl < 0 || config.ttl > 86400 * 7)) {
    return false; // TTL 不能为负数或超过7天
  }

  if (config.maxSize && config.maxSize < 0) {
    return false;
  }

  if (config.compressionThreshold && config.compressionThreshold < 0) {
    return false;
  }

  return true;
}
