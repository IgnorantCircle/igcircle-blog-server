import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { StructuredLoggerService } from '../logger/structured-logger.service';
import { RateLimitException } from '../exceptions/business.exception';
interface RateLimitOptions {
  windowMs: number; // 时间窗口（毫秒）
  max: number; // 最大请求次数
  message?: string; // 限流消息
  skipSuccessfulRequests?: boolean; // 是否跳过成功请求
  skipFailedRequests?: boolean; // 是否跳过失败请求
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly defaultOptions: RateLimitOptions = {
    windowMs: 60 * 1000, // 1分钟
    max: 500, // 每分钟最多500个请求
  };

  private readonly authRouteOptions: RateLimitOptions = {
    windowMs: 60 * 1000, // 1分钟
    max: 10, // 认证相关接口每分钟最多5个请求
  };

  // 缓存键前缀
  private readonly CACHE_PREFIX = 'rate_limit:';

  constructor(
    private readonly logger: StructuredLoggerService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    this.logger.setContext({ module: 'RateLimitMiddleware' });
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // 使用 originalUrl 来获取完整的请求路径
    const fullPath = (req.originalUrl || req.url).split('?')[0]; // 移除查询参数

    const ip = this.getClientIp(req);
    // 将路径包含在键中，确保不同路径有独立的限流计数器
    // 移除User-Agent以避免缓存键不匹配问题
    const key = `${ip}:${fullPath}`;

    // 根据路由选择不同的限制策略
    // 使用 req.url 而不是 req.path 来获取完整路径
    const options = this.getOptionsForRoute(fullPath);

    // 添加调试日志
    this.logger.debug('限流中间件执行', {
      action: 'rate_limit_middleware_execute',
      metadata: {
        ip,
        path: req.path,
        key,
        options,
      },
    });

    try {
      // 使用缓存获取当前计数
      const now = Date.now();
      const cacheKey = `${this.CACHE_PREFIX}${key}`;

      const record = await this.getRateLimitRecord(cacheKey);

      // 如果记录不存在或已过期，重置计数
      if (!record || now > record.resetTime) {
        await this.setRateLimitRecord(
          cacheKey,
          {
            count: 1,
            resetTime: now + options.windowMs,
          },
          options.windowMs,
        );

        // 设置响应头
        const headers = {
          'X-RateLimit-Limit': options.max.toString(),
          'X-RateLimit-Remaining': (options.max - 1).toString(),
          'X-RateLimit-Reset': new Date(now + options.windowMs).toISOString(),
        };
        res.set(headers);

        next();
        return;
      }

      if (record.count >= options.max) {
        // 记录安全日志
        this.logger.security('请求频率超限', 'warn', {
          ip,
          url: req.path,
          userAgent: req.get('User-Agent') || 'unknown',
          metadata: {
            event: 'rate_limit_exceeded',
            severity: 'medium',
            current: record.count,
            limit: options.max,
            windowMs: options.windowMs,
          },
        });

        // 设置响应头
        res.set({
          'X-RateLimit-Limit': options.max.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(
            Date.now() + options.windowMs,
          ).toISOString(),
        });

        throw new RateLimitException();
      }

      // 增加计数
      record.count += 1;
      await this.setRateLimitRecord(
        cacheKey,
        record,
        Math.max(1000, record.resetTime - now),
      );

      // 设置响应头
      const remaining = Math.max(0, options.max - record.count);
      const headers = {
        'X-RateLimit-Limit': options.max.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(record.resetTime).toISOString(),
      };

      res.set(headers);

      // 记录访问日志（仅在接近限制时）
      if (remaining <= 5) {
        this.logger.warn('请求频率接近限制', {
          action: 'rate_limit_warning',
          resource: req.path,
          metadata: {
            ip,
            userAgent: req.get('User-Agent') || 'unknown',
            current: record.count,
            limit: options.max,
            remaining,
          },
        });
      }

      next();
    } catch (error) {
      if (error instanceof RateLimitException) {
        throw error;
      }

      // 限流服务出错时，允许请求通过，但记录错误
      this.logger.error(
        '限流中间件错误',
        error instanceof Error ? error.stack : undefined,
        {
          action: 'rate_limit_error',
          resource: req.path,
          metadata: {
            ip,
            userAgent: req.get('User-Agent') || 'unknown',
            error: error instanceof Error ? error.message : String(error),
          },
        },
      );
      next();
    }
  }

  private getClientIp(req: Request): string {
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  private getOptionsForRoute(path: string): RateLimitOptions {
    // 根据不同路由设置不同的限流策略
    const routeConfigs: Record<string, Partial<RateLimitOptions>> = {
      '/api/auth/login': {
        windowMs: 15 * 60 * 1000, // 15分钟
        max: 10, // 登录接口更严格
        message: '登录尝试过于频繁，请15分钟后再试',
      },
      '/api/auth/register': {
        windowMs: 60 * 60 * 1000, // 1小时
        max: 5, // 注册接口最严格
        message: '注册尝试过于频繁，请1小时后再试',
      },
      '/api/auth/send-verification-code': {
        windowMs: 60 * 1000, // 1分钟
        max: 1, // 验证码发送限制
        message: '验证码发送过于频繁，请1分钟后再试',
      },
    };

    const config = routeConfigs[path] || {};
    return { ...this.defaultOptions, ...config };
  }

  /**
   * 从缓存获取限流记录
   */
  private async getRateLimitRecord(
    cacheKey: string,
  ): Promise<{ count: number; resetTime: number } | null> {
    try {
      const record = await this.cache.get(cacheKey);
      if (record && typeof record === 'object') {
        return record as { count: number; resetTime: number };
      }
      return null;
    } catch (error) {
      this.logger.error(
        '获取限流记录失败',
        error instanceof Error ? error.stack : undefined,
        {
          action: 'get_rate_limit_record_error',
          metadata: { cacheKey },
        },
      );
      return null;
    }
  }

  /**
   * 设置限流记录到缓存
   */
  private async setRateLimitRecord(
    cacheKey: string,
    record: { count: number; resetTime: number },
    ttlMs: number,
  ): Promise<void> {
    try {
      await this.cache.set(cacheKey, record, ttlMs);
    } catch (error) {
      // console.log('缓存设置错误:', error);
      this.logger.error(
        '设置限流记录失败',
        error instanceof Error ? error.stack : undefined,
        {
          action: 'set_rate_limit_record_error',
          metadata: { cacheKey, ttlMs },
        },
      );
    }
  }
}

// 装饰器工厂，用于在控制器中应用限流
export function RateLimit(options: Partial<RateLimitOptions> = {}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    // 这里可以存储路由特定的限流配置
    Reflect.defineMetadata('rateLimit', options, descriptor.value);
  };
}
