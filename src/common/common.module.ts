import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CacheService } from './cache/cache.service';
import { StructuredLoggerService } from './logger/structured-logger.service';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';
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
    CacheModule.register({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot({}),
  ],
  providers: [CacheService, StructuredLoggerService, RateLimitMiddleware],
  exports: [CacheService, StructuredLoggerService, RateLimitMiddleware],
})
export class CommonModule {}
