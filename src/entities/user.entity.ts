import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50, unique: true })
  username: string;

  @Column({ length: 100, unique: true })
  email: string;

  @Column({ length: 255 })
  password: string;

  @Column({ length: 50, nullable: true })
  nickname: string;

  @Column({ type: 'longtext', nullable: true })
  avatar: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'banned'],
    default: 'active',
  })
  status: string;

  @Column({ type: 'enum', enum: ['user', 'admin'], default: 'user' })
  role: string;

  @Column({ type: 'timestamp', nullable: true })
  lastActiveAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  forcedLogoutAt: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
