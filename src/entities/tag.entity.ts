import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  Index,
} from 'typeorm';
import { Article } from './article.entity';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50, unique: true })
  name: string;

  @Column({ length: 100, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string; // 标签颜色

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToMany(() => Article, (article) => article.tags)
  articles: Article[];

  @Column({ type: 'int', default: 0 })
  articleCount: number; // 使用该标签的文章数量

  @Column({ type: 'int', default: 0 })
  @Index()
  popularity: number; // 标签热度

  @Column({ type: 'bigint' })
  createdAt: number;

  @Column({ type: 'bigint' })
  updatedAt: number;

  @Column({ type: 'bigint', nullable: true })
  deletedAt: number | null;
}
