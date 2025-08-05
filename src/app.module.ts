import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { UserModule } from '@/modules/user.module';
import { ArticleModule } from '@/modules/article.module';
import { CategoryModule } from '@/modules/category.module';
import { TagModule } from '@/modules/tag.module';
import { ExampleModule } from '@/modules/example.module';
import { AuthModule } from '@/modules/auth.module';
import { getDatabaseConfig } from '@/config/database.config';
import { getRedisConfig } from '@/config/redis.config';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor';

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
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
  ],
  providers: [
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
export class AppModule {}
