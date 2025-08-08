import { Module } from '@nestjs/common';
import { AdminArticleController } from '@/controllers/admin/article.controller';
import { AdminUserController } from '@/controllers/admin/user.controller';
import { AdminCacheController } from '@/controllers/admin/cache.controller';
import { ArticleImportController } from '@/controllers/admin/article-import.controller';
import { ArticleModule } from './article.module';
import { UserModule } from './user.module';
import { AuthModule } from './auth.module';
import { ArticleImportModule } from './article-import.module';

@Module({
  imports: [ArticleModule, UserModule, AuthModule, ArticleImportModule],
  controllers: [
    AdminArticleController,
    AdminUserController,
    AdminCacheController,
    ArticleImportController,
  ],
})
export class AdminModule {}
