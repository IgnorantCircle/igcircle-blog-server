import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

/**
 * 用户端个人资料DTO - 用户查看自己的完整信息
 */
export class UserProfileDto {
  @ApiProperty({ description: '用户ID' })
  @Expose()
  id: number;

  @ApiProperty({ description: '用户名' })
  @Expose()
  username: string;

  @ApiProperty({ description: '邮箱' })
  @Expose()
  email: string;

  @ApiProperty({ description: '昵称' })
  @Expose()
  nickname: string;

  @ApiProperty({ description: '头像' })
  @Expose()
  avatar: string;

  @ApiProperty({ description: '个人简介' })
  @Expose()
  bio: string;

  @ApiProperty({ description: '用户状态', enum: ['active', 'inactive', 'banned'] })
  @Expose()
  status: string;

  @ApiProperty({ description: '创建时间' })
  @Expose()
  @Transform(({ value }) => value?.toISOString())
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @Expose()
  @Transform(({ value }) => value?.toISOString())
  updatedAt: Date;

  // 敏感信息不暴露
  @Exclude()
  password: string;

  @Exclude()
  role: string;
}

/**
 * 用户端文章DTO - 用户查看自己的文章信息
 */
export class UserArticleDto {
  @ApiProperty({ description: '文章ID' })
  @Expose()
  id: number;

  @ApiProperty({ description: '标题' })
  @Expose()
  title: string;

  @ApiProperty({ description: '摘要' })
  @Expose()
  summary: string;

  @ApiProperty({ description: 'slug' })
  @Expose()
  slug: string;

  @ApiProperty({ description: '封面图片' })
  @Expose()
  coverImage: string;

  @ApiProperty({ description: '文章状态', enum: ['draft', 'published', 'archived'] })
  @Expose()
  status: string;

  @ApiProperty({ description: '阅读时间' })
  @Expose()
  readingTime: number;

  @ApiProperty({ description: '浏览次数' })
  @Expose()
  viewCount: number;

  @ApiProperty({ description: '点赞数' })
  @Expose()
  likeCount: number;

  @ApiProperty({ description: '分享数' })
  @Expose()
  shareCount: number;

  @ApiProperty({ description: '是否精选' })
  @Expose()
  isFeatured: boolean;

  @ApiProperty({ description: '是否置顶' })
  @Expose()
  isTop: boolean;

  @ApiProperty({ description: 'SEO描述' })
  @Expose()
  metaDescription: string;

  @ApiProperty({ description: 'SEO关键词' })
  @Expose()
  metaKeywords: string[];

  @ApiProperty({ description: '社交分享图片' })
  @Expose()
  socialImage: string;

  @ApiProperty({ description: '是否允许评论' })
  @Expose()
  allowComment: boolean;

  @ApiProperty({ description: '发布时间' })
  @Expose()
  @Transform(({ value }) => value?.toISOString())
  publishedAt: Date;

  @ApiProperty({ description: '创建时间' })
  @Expose()
  @Transform(({ value }) => value?.toISOString())
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @Expose()
  @Transform(({ value }) => value?.toISOString())
  updatedAt: Date;

  @ApiProperty({ description: '标签列表' })
  @Expose()
  tags: any[];

  @ApiProperty({ description: '分类信息' })
  @Expose()
  category: any;

  // 隐藏管理员专用字段
  @Exclude()
  authorId: string;

  @Exclude()
  weight: number;
}

/**
 * 用户端文章详情DTO - 包含文章内容
 */
export class UserArticleDetailDto extends UserArticleDto {
  @ApiProperty({ description: '文章内容' })
  @Expose()
  content: string;
}

/**
 * 用户端其他用户信息DTO - 查看其他用户的公开信息
 */
export class UserPublicDto {
  @ApiProperty({ description: '用户ID' })
  @Expose()
  id: number;

  @ApiProperty({ description: '用户名' })
  @Expose()
  username: string;

  @ApiProperty({ description: '昵称' })
  @Expose()
  nickname: string;

  @ApiProperty({ description: '头像' })
  @Expose()
  avatar: string;

  @ApiProperty({ description: '个人简介' })
  @Expose()
  bio: string;

  @ApiProperty({ description: '创建时间' })
  @Expose()
  @Transform(({ value }) => value?.toISOString())
  createdAt: Date;

  // 隐藏敏感信息
  @Exclude()
  email: string;

  @Exclude()
  password: string;

  @Exclude()
  role: string;

  @Exclude()
  status: string;

  @Exclude()
  updatedAt: Date;
}