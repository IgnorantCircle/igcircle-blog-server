import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  OneToMany,
  JoinColumn,
  JoinTable,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Tag } from './tag.entity';
import { Category } from './category.entity';
import { Comment } from './comment.entity';

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  @Index()
  title: string;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ type: 'longtext' })
  content: string;

  @Column({ length: 200, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  coverImage: string;

  @ManyToMany(() => Tag, { cascade: true })
  @JoinTable({
    name: 'article_tags',
    joinColumn: { name: 'articleId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tagId', referencedColumnName: 'id' },
  })
  tags: Tag[];

  @Column({
    type: 'enum',
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
  })
  @Index()
  status: string;

  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @Column({ type: 'int', default: 0 })
  likeCount: number;

  @Column({ type: 'int', default: 0 })
  commentCount: number;

  @Column({ type: 'boolean', default: true })
  allowComment: boolean;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  // SEO 相关字段
  @Column({ type: 'text', nullable: true })
  metaDescription: string;

  @Column({ type: 'json', nullable: true })
  metaKeywords: string[];

  @Column({ type: 'text', nullable: true })
  socialImage: string; // 社交媒体分享图片

  // 内容相关
  @Column({ type: 'int', nullable: true })
  readingTime: number; // 预计阅读时间（分钟）

  @Column({ type: 'boolean', default: false })
  isFeatured: boolean; // 是否为精选文章

  @Column({ type: 'boolean', default: false })
  isTop: boolean; // 是否置顶

  @Column({ type: 'boolean', default: true })
  isVisible: boolean; // 是否对用户端可见

  @Column({ type: 'int', default: 0 })
  @Index()
  weight: number; // 权重，用于排序

  // 统计字段
  @Column({ type: 'int', default: 0 })
  shareCount: number; // 分享次数

  // 分类关联
  @Column({ type: 'varchar', nullable: true })
  categoryId: string;

  @ManyToOne(() => Category, 'articles', {
    eager: true,
  })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;

  @Column()
  authorId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'authorId' })
  author: User;

  // 评论关联
  @OneToMany(() => Comment, 'article')
  comments: Comment[];
}
