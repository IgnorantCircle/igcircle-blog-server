import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheStrategyService } from './cache/cache-strategy.service';
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
  ],
  providers: [
    CacheStrategyService,
    StructuredLoggerService,
    RateLimitMiddleware,
  ],
  exports: [CacheStrategyService, StructuredLoggerService, RateLimitMiddleware],
})
export class CommonModule {}
