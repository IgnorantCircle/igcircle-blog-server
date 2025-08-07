import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { UserModule } from '@/modules/user.module';
import { ArticleModule } from '@/modules/article.module';
import { CategoryModule } from '@/modules/category.module';
import { TagModule } from '@/modules/tag.module';
import { ExampleModule } from '@/modules/example.module';
import { AuthModule } from '@/modules/auth.module';
import { AdminModule } from '@/modules/admin.module';
import { getDatabaseConfig } from '@/config/database.config';
import { getRedisConfig } from '@/config/redis.config';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor';
import { configFactory } from '@/common/config/config.validation';
import { JwtAuthGuard } from '@/guards/auth.guard';
import { RateLimitMiddleware } from '@/common/middleware/rate-limit.middleware';

@Module({
  imports: [
    // 配置模块（带验证）
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configFactory],
      validate: configFactory,
    }),

    // 数据库模块
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),

    // Redis缓存模块
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: getRedisConfig,
      inject: [ConfigService],
      isGlobal: true,
    }),

    // 业务模块
    UserModule,
    ArticleModule,
    CategoryModule,
    TagModule,
    ExampleModule,

    // 认证模块
    AuthModule,

    AdminModule,
  ],
  providers: [
    // 全局认证守卫
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // 全局异常过滤器
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // 全局响应拦截器
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RateLimitMiddleware).forRoutes('*'); // 对所有路由应用限流中间件
  }
}
