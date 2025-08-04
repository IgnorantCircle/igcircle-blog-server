import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '@/entities/user.entity';
import { UserService } from '@/services/user.service';
import { AdminUserController } from '@/controllers/admin/user.controller';
import { JwtAuthGuard } from '@/guards/auth.guard';
import { RolesGuard } from '@/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AdminUserController],
  providers: [UserService, JwtAuthGuard, RolesGuard],
  exports: [UserService],
})
export class UserModule {}
