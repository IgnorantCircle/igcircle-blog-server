import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from '@/entities/article.entity';
import { Tag } from '@/entities/tag.entity';
import { Category } from '@/entities/category.entity';
import { ArticleService } from '@/services/article/article.service';
import { ArticleQueryService } from '@/services/article/article-query.service';
import { ArticleStatisticsService } from '@/services/article/article-statistics.service';
import { ArticleStatusService } from '@/services/article/article-status.service';
import { TagService } from '@/services/tag.service';
import { CategoryService } from '@/services/category.service';
import { AuthModule } from './auth.module';
import { SharedAuthModule } from './shared-auth.module';
import { CommonModule } from '@/common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Article, Tag, Category]),
    CommonModule,
    AuthModule,
    SharedAuthModule,
  ],
  controllers: [],
  providers: [
    ArticleService,
    ArticleQueryService,
    ArticleStatisticsService,
    ArticleStatusService,
    TagService,
    CategoryService,
  ],
  exports: [ArticleService, ArticleQueryService],
})
export class ArticleModule {}
