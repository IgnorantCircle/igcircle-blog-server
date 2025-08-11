import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CacheModule } from '@nestjs/cache-manager';
import { StructuredLoggerService } from './logger/structured-logger.service';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';
import { BlogCacheService } from './cache/blog-cache.service';
import { configFactory } from './config/config.validation';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.development.local'],
      load: [configFactory],
      validationSchema: undefined, // 使用自定义验证
    }),
    EventEmitterModule.forRoot({}),
    CacheModule.register({
      isGlobal: true,
      ttl: 300, // 5分钟默认TTL
      max: 1000, // 最大缓存项数
      disableKeyvPrefix: true, //禁用 keyv 自带的前缀
    }),
  ],
  providers: [StructuredLoggerService, RateLimitMiddleware, BlogCacheService],
  exports: [StructuredLoggerService, RateLimitMiddleware, BlogCacheService],
})
export class CommonModule {}
