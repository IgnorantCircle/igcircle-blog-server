import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { StructuredLoggerService } from './logger/structured-logger.service';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';
import { HttpRequestLoggerMiddleware } from './middleware/http-request-logger.middleware';
import { BlogCacheService } from './cache/blog-cache.service';
import { LogManagementService } from '../services/common/log-management.service';
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
    ScheduleModule.forRoot(), // 添加定时任务模块
    CacheModule.register({
      isGlobal: true,
      ttl: 300, // 5分钟默认TTL
      max: 1000, // 最大缓存项数
      disableKeyvPrefix: true, //禁用 keyv 自带的前缀
    }),
  ],
  providers: [
    LogManagementService, // 确保在StructuredLoggerService之前
    {
      provide: StructuredLoggerService,
      useFactory: (configService, logManagementService) => {
        return new StructuredLoggerService(configService, logManagementService);
      },
      inject: [ConfigService, LogManagementService],
    },
    RateLimitMiddleware,
    HttpRequestLoggerMiddleware,
    BlogCacheService,
  ],
  exports: [
    LogManagementService,
    StructuredLoggerService,
    RateLimitMiddleware,
    HttpRequestLoggerMiddleware,
    BlogCacheService,
  ],
})
export class CommonModule {}
