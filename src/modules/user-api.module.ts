import { Module } from '@nestjs/common';
import { UserProfileController } from '@/controllers/user/profile.controller';
import { UserModule } from './user.module';
import { AuthModule } from './auth.module';

@Module({
  imports: [UserModule, AuthModule],
  controllers: [UserProfileController],
})
export class UserApiModule {}
