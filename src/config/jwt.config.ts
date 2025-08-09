import { ConfigService } from '@nestjs/config';
import { JwtModuleAsyncOptions } from '@nestjs/jwt';

/**
 * JWT配置工厂
 * 统一管理JWT相关配置，避免在多个模块中重复配置
 */
export const jwtConfigFactory: JwtModuleAsyncOptions = {
  useFactory: (configService: ConfigService) => ({
    secret: configService.get<string>('JWT_SECRET'),
    signOptions: {
      expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
    },
  }),
  inject: [ConfigService],
};
