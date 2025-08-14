import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticleImportController } from '@/controllers/admin/article-import.controller';
import { ArticleImportService } from '@/services/article-import/article-import.service';
import { ArticleParserService } from '@/services/article-import/article-parser.service';
import { ImportProgressService } from '@/services/article-import/import-progress.service';
import { ImportValidationService } from '@/services/article-import/import-validation.service';
import { FileValidationService } from '@/services/article-import/common/file-validation.service';
import { ConfigValidationService } from '@/services/article-import/common/config-validation.service';
import { AuthModule } from '@/modules/auth.module';
import { ArticleModule } from '@/modules/article.module';
import { TagModule } from '@/modules/tag.module';
import { CategoryModule } from '@/modules/category.module';
import { Article } from '@/entities/article.entity';
import { Tag } from '@/entities/tag.entity';
import { Category } from '@/entities/category.entity';
import { User } from '@/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Article, Tag, Category, User]),
    AuthModule,
    ArticleModule,
    TagModule,
    CategoryModule,
  ],
  controllers: [ArticleImportController],
  providers: [
    ArticleImportService,
    ArticleParserService,
    ImportProgressService,
    ImportValidationService,
    FileValidationService,
    ConfigValidationService,
  ],
  exports: [ArticleImportService],
})
export class ArticleImportModule {}
