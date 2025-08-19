import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';
import { QueryArrayTransformPipe } from '@/common/pipes/query-array-transform.pipe';
import { BooleanTransformPipe } from '@/common/pipes/boolean-transform.pipe';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = await app.resolve(StructuredLoggerService);
  logger.setContext({ module: 'Bootstrap' });

  // 设置全局日志器
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  // 启用CORS
  const corsOrigins: (string | RegExp)[] =
    configService
      .get<string>('CORS_ORIGIN')
      ?.split(',')
      .map((origin: string) => origin.trim()) || [];

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], // 允许的HTTP方法
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'], // 允许的请求头
    credentials: true, // 允许携带Cookie（需前端配合设置withCredentials）
  });
  // 全局路由前缀
  app.setGlobalPrefix('api');
  // 全局管道：先参数转换，再进行验证
  app.useGlobalPipes(
    new BooleanTransformPipe(app.get(Reflector)),
    new QueryArrayTransformPipe(),
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 配置Swagger文档
  const config = new DocumentBuilder()
    .setTitle('igCircle Blog API')
    .setDescription('igCircle博客系统API文档')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('1.1 管理端API - 文章导入')
    .addTag('1.2 管理端API - 文章管理')
    .addTag('1.3 管理端API - 分类管理')
    .addTag('1.4 管理端API - 评论管理')
    .addTag('1.5 管理端API - 标签管理')
    .addTag('1.6 管理端API - 用户管理')
    .addTag('2.1 用户端API - 文章操作')
    .addTag('2.2 用户端API - 评论管理')
    .addTag('2.3 用户端API - 个人资料')
    .addTag('3.1 公共API - 文章')
    .addTag('3.2 公共API - 分类')
    .addTag('3.3 公共API - 标签')
    .addTag('4.1 认证API - 登录注册')
    .addTag('4.2 开发工具API - RSA加密')
    .addTag('5 示例API - 示例接口')
    .addTag('6 开发工具API - 缓存管理')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);

  logger.log('应用程序启动成功', {
    action: 'application_start',
    metadata: {
      port,
      appUrl: `http://localhost:${port}`,
      docsUrl: `http://localhost:${port}/api/docs`,
      apiUrl: `http://localhost:${port}/api`,
    },
  });
}
bootstrap();
