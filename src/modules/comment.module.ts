import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from '@/entities/comment.entity';
import { CommentLike } from '@/entities/comment-like.entity';
import { Article } from '@/entities/article.entity';
import { User } from '@/entities/user.entity';
import { CommentService } from '@/services/comment.service';
import { UserCommentController } from '@/controllers/user/comment.controller';
import { AdminCommentController } from '@/controllers/admin/comment.controller';
import { AuthModule } from './auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, CommentLike, Article, User]),
    AuthModule,
  ],
  controllers: [UserCommentController, AdminCommentController],
  providers: [CommentService],
  exports: [CommentService],
})
export class CommentModule {}
