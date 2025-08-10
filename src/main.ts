import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';
import { QueryArrayTransformPipe } from '@/common/pipes/query-array-transform.pipe';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = await app.resolve(StructuredLoggerService);
  logger.setContext({ module: 'Bootstrap' });
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
  // 全局管道：先处理数组参数转换，再进行验证
  app.useGlobalPipes(
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
    .addTag('users', '用户管理')
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
