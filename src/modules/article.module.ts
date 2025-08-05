import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from '@/entities/article.entity';
import { Tag } from '@/entities/tag.entity';
import { Category } from '@/entities/category.entity';
import { AdminArticleController } from '@/controllers/admin/article.controller';
import { ArticleService } from '@/services/article.service';
import { TagService } from '@/services/tag.service';
import { CategoryService } from '@/services/category.service';
import { AuthModule } from './auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Article, Tag, Category]), AuthModule],
  controllers: [AdminArticleController],
  providers: [ArticleService, TagService, CategoryService],
  exports: [ArticleService],
})
export class ArticleModule {}
