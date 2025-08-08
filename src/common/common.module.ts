import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CacheStrategyService } from './cache/cache-strategy.service';
import { CacheManagerService } from './cache/cache-manager.service';
import { CacheEventListener } from './cache/cache-event.listener';
import { CacheInterceptor } from './interceptors/cache.interceptor';
import { CacheMonitorService } from './cache/cache-monitor.service';
import { StructuredLoggerService } from './logger/structured-logger.service';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';
import { configFactory } from './config/config.validation';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configFactory],
      validationSchema: undefined, // 使用自定义验证
    }),
    CacheModule.register({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot({}),
  ],
  providers: [
    CacheStrategyService,
    CacheManagerService,
    StructuredLoggerService,
    RateLimitMiddleware,
    CacheEventListener,
    CacheInterceptor,
    CacheMonitorService,
  ],
  exports: [
    CacheStrategyService,
    CacheManagerService,
    StructuredLoggerService,
    RateLimitMiddleware,
    CacheEventListener,
    CacheInterceptor,
    CacheMonitorService,
  ],
})
export class CommonModule {}
