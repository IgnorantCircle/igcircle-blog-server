import { Module } from '@nestjs/common';
import { UserProfileController } from '@/controllers/user/profile.controller';
import { UserArticleController } from '@/controllers/user/article.controller';
import { UserModule } from './user.module';
import { ArticleModule } from './article.module';
import { AuthModule } from './auth.module';
import { SharedAuthModule } from './shared-auth.module';

@Module({
  imports: [UserModule, ArticleModule, AuthModule, SharedAuthModule],
  controllers: [UserProfileController, UserArticleController],
})
export class UserApiModule {}
