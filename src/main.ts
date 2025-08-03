import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  // 启用CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });
  // 全局路由前缀
  app.setGlobalPrefix('api');
  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
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
  console.log(`🚀 应用程序运行在: http://localhost:${port}`);
  console.log(`📚 Swagger API文档: http://localhost:${port}/api/docs`);
  console.log(`🔗 基础API地址: http://localhost:${port}/api`);
}
bootstrap();
