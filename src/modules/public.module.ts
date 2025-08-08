import { Module } from '@nestjs/common';
import { PublicArticleController } from '@/controllers/public/article.controller';
import { PublicCategoryController } from '@/controllers/public/category.controller';
import { PublicTagController } from '@/controllers/public/tag.controller';
import { ArticleModule } from './article.module';
import { CategoryModule } from './category.module';
import { TagModule } from './tag.module';

@Module({
  imports: [ArticleModule, CategoryModule, TagModule],
  controllers: [
    PublicArticleController,
    PublicCategoryController,
    PublicTagController,
  ],
})
export class PublicModule {}
