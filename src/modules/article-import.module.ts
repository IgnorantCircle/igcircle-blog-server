import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticleImportController } from '@/controllers/admin/article-import.controller';
import { ArticleImportService } from '@/services/article-import.service';
import { ArticleService } from '@/services/article.service';
import { TagService } from '@/services/tag.service';
import { CategoryService } from '@/services/category.service';
import { AuthModule } from '@/modules/auth.module';
import { Article } from '@/entities/article.entity';
import { Tag } from '@/entities/tag.entity';
import { Category } from '@/entities/category.entity';
import { User } from '@/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Article, Tag, Category, User]),
    AuthModule,
  ],
  controllers: [ArticleImportController],
  providers: [
    ArticleImportService,
    ArticleService,
    TagService,
    CategoryService,
  ],
  exports: [ArticleImportService],
})
export class ArticleImportModule {}
