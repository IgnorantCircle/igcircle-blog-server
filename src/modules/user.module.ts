import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/entities/user.entity';
import { UserService } from '@/services/user.service';
import { AdminUserController } from '@/controllers/admin/user.controller';

import { SharedAuthModule } from './shared-auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), SharedAuthModule],
  controllers: [AdminUserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
