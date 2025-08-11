import { Module } from '@nestjs/common';
import { AdminArticleController } from '@/controllers/admin/article.controller';
import { AdminUserController } from '@/controllers/admin/user.controller';
import { ArticleModule } from './article.module';
import { UserModule } from './user.module';
import { AuthModule } from './auth.module';
import { ArticleImportModule } from './article-import.module';
import { CommonModule } from '@/common/common.module';

@Module({
  imports: [
    ArticleModule,
    UserModule,
    AuthModule,
    ArticleImportModule,
    CommonModule,
  ],
  controllers: [AdminArticleController, AdminUserController],
})
export class AdminModule {}
