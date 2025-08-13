import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Article } from './article.entity';
import { User } from './user.entity';

@Entity('article_views')
@Index('IDX_article_user', ['articleId', 'userId']) // 用于查询优化
@Index('IDX_article_ip', ['articleId', 'ipAddress']) // 用于查询优化
export class ArticleView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  articleId: string;

  @ManyToOne(() => Article, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'articleId' })
  article: Article;

  @Column({ nullable: true })
  @Index()
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ type: 'varchar', length: 45, nullable: true }) // IPv4/IPv6
  @Index()
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}