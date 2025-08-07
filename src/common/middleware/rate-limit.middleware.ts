import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CacheStrategyService } from '../cache/cache-strategy.service';
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
    max: 100, // 每分钟最多100个请求
  };

  private readonly authRouteOptions: RateLimitOptions = {
    windowMs: 60 * 1000, // 1分钟
    max: 5, // 认证相关接口每分钟最多5个请求
  };

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly cacheStrategy: CacheStrategyService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext({ module: 'RateLimitMiddleware' });
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const ip = this.getClientIp(req);
    const userAgent = req.get('User-Agent') || 'unknown';
    const key = `${ip}:${userAgent}`;

    // 根据路由选择不同的限制策略
    const options = this.getOptionsForRoute(req.path);

    try {
      // 使用新的缓存策略获取当前计数
      const current =
        (await this.cacheStrategy.get<number>(key, { type: 'stats' })) || 0;

      if (current >= options.max) {
        // 记录安全日志
        this.logger.security('请求频率超限', {
          securityEvent: 'rate_limit_exceeded',
          severity: 'medium',
          sourceIp: ip,
          targetResource: req.path,
          userAgent,
          metadata: {
            current,
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
      await this.cacheStrategy.set(key, current + 1, {
        type: 'stats',
        ttl: Math.ceil(options.windowMs / 1000),
      });

      // 设置响应头
      const remaining = Math.max(0, options.max - current - 1);
      res.set({
        'X-RateLimit-Limit': options.max.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(
          Date.now() + options.windowMs,
        ).toISOString(),
      });

      // 记录访问日志（仅在接近限制时）
      if (remaining <= 5) {
        this.logger.warn('请求频率接近限制', {
          action: 'rate_limit_warning',
          resource: req.path,
          metadata: {
            ip,
            userAgent,
            current: current + 1,
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
      this.logger.error('限流中间件错误', error.stack, {
        action: 'rate_limit_error',
        resource: req.path,
        metadata: { ip, userAgent, error: error.message },
      });
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
        max: 5, // 登录接口更严格
        message: '登录尝试过于频繁，请15分钟后再试',
      },
      '/api/auth/register': {
        windowMs: 60 * 60 * 1000, // 1小时
        max: 3, // 注册接口最严格
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
