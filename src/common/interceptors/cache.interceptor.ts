import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { CacheStrategyService } from '../cache/cache-strategy.service';
import { StructuredLoggerService } from '../logger/structured-logger.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly cacheStrategy: CacheStrategyService,
    private readonly logger: StructuredLoggerService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.setContext({ module: 'CacheInterceptor' });
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const cacheOptions = this.reflector.getAllAndOverride<
      Record<string, unknown>
    >('cache', [context.getHandler(), context.getClass()]);

    const cacheEvictOptions = this.reflector.getAllAndOverride<
      Record<string, unknown>
    >('cacheEvict', [context.getHandler(), context.getClass()]);

    const cachePutOptions = this.reflector.getAllAndOverride<
      Record<string, unknown>
    >('cachePut', [context.getHandler(), context.getClass()]);

    const cacheCondition = this.reflector.getAllAndOverride<
      (...args: unknown[]) => boolean
    >('cacheCondition', [context.getHandler(), context.getClass()]);

    const cacheMonitor = this.reflector.getAllAndOverride<
      Record<string, unknown>
    >('cacheMonitor', [context.getHandler(), context.getClass()]);

    const cacheLock = this.reflector.getAllAndOverride<Record<string, unknown>>(
      'cacheLock',
      [context.getHandler(), context.getClass()],
    );

    const cacheFallback = this.reflector.get<string>(
      'cacheFallback',
      context.getHandler(),
    );

    const args = context.getArgs();
    const startTime = Date.now();

    // 检查缓存条件
    if (
      cacheCondition &&
      typeof cacheCondition === 'function' &&
      !cacheCondition(...args)
    ) {
      return next.handle();
    }

    // 处理缓存读取
    if (
      cacheOptions &&
      (cacheOptions as Record<string, unknown>).enabled !== false
    ) {
      try {
        const cacheKey = this.generateCacheKey(cacheOptions, args);
        const cachedResult = await this.cacheStrategy.get(cacheKey, {
          type:
            typeof cacheOptions?.type === 'string'
              ? cacheOptions.type
              : 'default',
        });

        if (cachedResult !== null && cachedResult !== undefined) {
          // 记录缓存命中
          if (cacheMonitor?.trackHitRate) {
            this.recordCacheHit(cacheKey, true, Date.now() - startTime);
          }

          this.logger.debug(
            `Cache hit for key: ${cacheKey}, type: ${typeof cacheOptions?.type === 'string' ? cacheOptions.type : 'default'}, executionTime: ${Date.now() - startTime}`,
          );

          return of(cachedResult);
        }

        // 缓存未命中，执行原方法
        return this.handleCacheMiss(
          next,
          cacheOptions,
          cacheKey,
          startTime,
          cacheMonitor,
          cacheLock,
        );
      } catch (error) {
        this.logger.error('Cache read error', (error as Error).message);

        // 根据降级策略处理
        if (cacheFallback === 'error') {
          return throwError(() => error) as Observable<unknown>;
        } else if (cacheFallback === 'skip') {
          return next.handle();
        }
        // 默认策略：继续执行原方法
      }
    }

    // 处理缓存失效
    if (cacheEvictOptions) {
      return (next.handle() as Observable<unknown>).pipe(
        tap((result) => {
          void this.handleCacheEviction(cacheEvictOptions);
          return result;
        }),
        catchError((error) => {
          this.logger.error(
            'Method execution error during cache eviction',
            (error as Error).message,
          );
          return throwError(() => error) as Observable<unknown>;
        }),
      );
    }

    // 处理缓存更新
    if (cachePutOptions) {
      return (next.handle() as Observable<unknown>).pipe(
        tap((result) => {
          void (async () => {
            try {
              const cacheKey = this.generateCacheKey(cachePutOptions, args);
              await this.cacheStrategy.set(cacheKey, result, {
                type:
                  typeof cachePutOptions?.type === 'string'
                    ? cachePutOptions.type
                    : 'default',
                ttl:
                  typeof cachePutOptions?.ttl === 'number'
                    ? cachePutOptions.ttl
                    : undefined,
                tags: Array.isArray(cachePutOptions?.tags)
                  ? cachePutOptions.tags
                  : undefined,
              });

              this.logger.debug(
                `Cache updated for key: ${cacheKey}, type: ${
                  typeof cachePutOptions?.type === 'string'
                    ? cachePutOptions.type
                    : 'default'
                }`,
              );
            } catch (error) {
              this.logger.error('Cache update error', (error as Error).message);
            }
          })();
          return result;
        }),
      );
    }

    return next.handle();
  }

  private async handleCacheMiss(
    next: CallHandler,
    cacheOptions: Record<string, unknown>,
    cacheKey: string,
    startTime: number,
    cacheMonitor: Record<string, unknown> | undefined,
    cacheLock: Record<string, unknown> | undefined,
  ): Promise<Observable<unknown>> {
    // 实现缓存锁，防止缓存击穿
    if (cacheLock) {
      const lockKey = `${(cacheLock?.keyPrefix as string) || 'lock'}:${cacheKey}`;
      const lockTimeout = (cacheLock?.timeout as number) || 5000;

      try {
        // 尝试获取锁
        const lockAcquired = await this.acquireLock(lockKey, lockTimeout);

        if (!lockAcquired) {
          // 等待一段时间后重试获取缓存
          await this.sleep(100);
          const cachedResult = await this.cacheStrategy.get(cacheKey, {
            type:
              typeof cacheOptions?.type === 'string'
                ? cacheOptions.type
                : 'default',
          });

          if (cachedResult !== null && cachedResult !== undefined) {
            return of(cachedResult);
          }
        }
      } catch (error) {
        this.logger.warn(
          `Cache lock error: ${(error as Error).message}, lockKey: ${lockKey}`,
        );
      }
    }

    return (next.handle() as Observable<unknown>).pipe(
      tap((result) => {
        void (async () => {
          try {
            // 缓存结果
            await this.cacheStrategy.set(cacheKey, result, {
              type:
                typeof cacheOptions?.type === 'string'
                  ? cacheOptions.type
                  : 'default',
              ttl:
                typeof cacheOptions?.ttl === 'number'
                  ? cacheOptions.ttl
                  : undefined,
              tags: Array.isArray(cacheOptions?.tags)
                ? (cacheOptions.tags as string[])
                : undefined,
            });

            // 记录缓存未命中
            if (cacheMonitor && cacheMonitor.trackHitRate) {
              this.recordCacheHit(cacheKey, false, Date.now() - startTime);
            }

            this.logger.debug(
              `Cache miss - result cached for key: ${cacheKey}, type: ${typeof cacheOptions?.type === 'string' ? cacheOptions.type : 'default'}, executionTime: ${Date.now() - startTime}`,
            );
          } catch (error) {
            this.logger.error(`Cache write error: ${(error as Error).message}`);
          }
        })();
        return result;
      }),
      catchError((error) => {
        // 记录执行错误
        if (cacheMonitor && cacheMonitor.trackExecutionTime) {
          this.recordExecutionError(cacheKey, error, Date.now() - startTime);
        }
        return throwError(() => error);
      }),
    );
  }

  private async handleCacheEviction(
    cacheEvictOptions: Record<string, unknown>,
  ): Promise<void> {
    try {
      if (cacheEvictOptions?.allEntries) {
        // 清除所有缓存
        await this.cacheStrategy.clearAll();
        this.logger.log('All cache entries evicted');
        return;
      }

      const evictionPromises: Promise<void>[] = [];

      // 按标签清除
      if (
        cacheEvictOptions?.tags &&
        Array.isArray(cacheEvictOptions.tags) &&
        cacheEvictOptions.tags.length > 0
      ) {
        evictionPromises.push(
          this.cacheStrategy.clearByTags(cacheEvictOptions.tags as string[]),
        );
      }

      // 按模式清除
      if (
        cacheEvictOptions?.patterns &&
        Array.isArray(cacheEvictOptions.patterns) &&
        cacheEvictOptions.patterns.length > 0
      ) {
        for (const pattern of cacheEvictOptions.patterns as string[]) {
          evictionPromises.push(
            this.cacheStrategy.clearCacheByPattern(pattern),
          );
        }
      }

      // 按类型清除
      if (
        cacheEvictOptions?.types &&
        Array.isArray(cacheEvictOptions.types) &&
        cacheEvictOptions.types.length > 0
      ) {
        for (const type of cacheEvictOptions.types as string[]) {
          evictionPromises.push(this.cacheStrategy.clearByTags([type]));
        }
      }

      await Promise.all(evictionPromises);

      this.logger.log(
        `Cache eviction completed: tags=${Array.isArray(cacheEvictOptions?.tags) ? cacheEvictOptions.tags.join(',') : 'none'}, patterns=${Array.isArray(cacheEvictOptions?.patterns) ? cacheEvictOptions.patterns.join(',') : 'none'}, types=${Array.isArray(cacheEvictOptions?.types) ? cacheEvictOptions.types.join(',') : 'none'}`,
      );
    } catch (error) {
      this.logger.error(`Cache eviction error: ${(error as Error).message}`);
    }
  }

  private generateCacheKey(
    cacheOptions: Record<string, unknown>,
    args: unknown[],
  ): string {
    if (
      cacheOptions?.keyGenerator &&
      typeof cacheOptions.keyGenerator === 'function'
    ) {
      return (cacheOptions.keyGenerator as (...args: unknown[]) => string)(
        ...args,
      );
    }

    if (
      cacheOptions?.key &&
      typeof cacheOptions.key === 'string' &&
      cacheOptions.key !== 'auto'
    ) {
      // 支持模板变量替换
      let key = cacheOptions.key;
      args.forEach((arg, index) => {
        if (typeof arg === 'string' || typeof arg === 'number') {
          key = key.replace(`{${index}}`, String(arg));
        } else if (typeof arg === 'object' && arg !== null) {
          // 支持对象属性替换
          const argObj = arg as Record<string, unknown>;
          Object.keys(argObj).forEach((prop) => {
            const propValue = argObj[prop];
            if (propValue !== null && propValue !== undefined) {
              let valueStr: string;
              if (typeof propValue === 'object' && propValue !== null) {
                try {
                  valueStr = JSON.stringify(propValue);
                } catch {
                  valueStr = '[object Object]';
                }
              } else if (
                typeof propValue === 'string' ||
                typeof propValue === 'number' ||
                typeof propValue === 'boolean'
              ) {
                valueStr = String(propValue);
              } else {
                valueStr = '[object Object]';
              }
              key = key.replace(`{${prop}}`, valueStr);
            }
          });
        }
      });
      return key;
    }

    // 自动生成缓存键
    const keyParts = args
      .filter((arg) => arg !== null && arg !== undefined)
      .map((arg) => {
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg);
          } catch {
            return '[object Object]';
          }
        }
        if (
          typeof arg === 'string' ||
          typeof arg === 'number' ||
          typeof arg === 'boolean'
        ) {
          return String(arg);
        }
        return '[object Object]';
      });

    return `auto:${keyParts.join(':')}`;
  }

  private async acquireLock(
    lockKey: string,
    timeout: number,
  ): Promise<boolean> {
    try {
      // 使用 Redis SET NX EX 命令实现分布式锁
      await this.cacheStrategy.set(lockKey, Date.now().toString(), {
        type: 'lock',
        ttl: Math.ceil(timeout / 1000),
      });
      return true;
    } catch (error) {
      this.logger.error(
        'Lock acquisition error',
        `Error: ${(error as Error).message}, Lock key: ${lockKey}`,
      );
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private recordCacheHit(
    key: string,
    hit: boolean,
    executionTime: number,
  ): void {
    // 实现缓存命中率记录逻辑
    const record = {
      cacheKey: key,
      hit,
      executionTime,
      timestamp: Date.now(),
    };
    this.logger.debug(`Cache hit recorded: ${JSON.stringify(record)}`);

    // 发送缓存监控事件
    this.eventEmitter.emit('cache.monitor', {
      key,
      hit,
      executionTime,
      timestamp: new Date(),
    });
  }

  private recordExecutionError(
    key: string,
    error: unknown,
    executionTime: number,
  ): void {
    // 发送执行错误监控事件
    this.eventEmitter.emit('cache.execution.error', {
      key,
      error: (error as Error).message || String(error),
      executionTime,
      timestamp: new Date(),
    });
  }
}
