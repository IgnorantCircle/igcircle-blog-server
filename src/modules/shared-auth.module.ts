import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '@/guards/roles.guard';
import { jwtConfigFactory } from '@/config/jwt.config';
import { User } from '@/entities/user.entity';
import { UserService } from '@/services/user.service';

/**
 * 共享认证模块
 * 专门提供认证相关的核心服务：JWT模块、用户服务和角色守卫
 * 为全局守卫和其他模块提供必要的依赖
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync(jwtConfigFactory),
    TypeOrmModule.forFeature([User]),
  ],
  providers: [UserService, RolesGuard],
  exports: [JwtModule, RolesGuard, UserService],
})
export class SharedAuthModule {}
