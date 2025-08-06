import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';

/**
 * 管理端分类响应DTO - 包含完整数据
 */
export class AdminCategoryDto {
  @ApiProperty({ description: '分类ID' })
  @Expose()
  id: string;

  @ApiProperty({ description: '分类名称' })
  @Expose()
  name: string;

  @ApiProperty({ description: '分类描述' })
  @Expose()
  description: string;

  @ApiProperty({ description: '分类slug' })
  @Expose()
  slug: string;

  @ApiProperty({ description: '分类封面图片' })
  @Expose()
  coverImage: string;

  @ApiProperty({ description: '分类颜色' })
  @Expose()
  color: string;

  @ApiProperty({ description: '排序权重' })
  @Expose()
  sortOrder: number;

  @ApiProperty({ description: '是否激活' })
  @Expose()
  isActive: boolean;

  @ApiProperty({ description: '文章数量' })
  @Expose()
  articleCount: number;

  @ApiProperty({ description: '创建时间' })
  @Expose()
  @Transform(({ value }): string =>
    typeof value === 'number' ? new Date(value).toISOString() : value,
  )
  createdAt: number;

  @ApiProperty({ description: '更新时间' })
  @Expose()
  @Transform(({ value }): string =>
    typeof value === 'number' ? new Date(value).toISOString() : value,
  )
  updatedAt: number;
}

/**
 * 管理端标签响应DTO - 包含完整数据
 */
export class AdminTagDto {
  @ApiProperty({ description: '标签ID' })
  @Expose()
  id: string;

  @ApiProperty({ description: '标签名称' })
  @Expose()
  name: string;

  @ApiProperty({ description: '标签slug' })
  @Expose()
  slug: string;

  @ApiProperty({ description: '标签描述' })
  @Expose()
  description: string;

  @ApiProperty({ description: '标签颜色' })
  @Expose()
  color: string;

  @ApiProperty({ description: '是否激活' })
  @Expose()
  isActive: boolean;

  @ApiProperty({ description: '文章数量' })
  @Expose()
  articleCount: number;

  @ApiProperty({ description: '创建时间' })
  @Expose()
  @Transform(({ value }): string =>
    typeof value === 'number' ? new Date(value).toISOString() : value,
  )
  createdAt: number;

  @ApiProperty({ description: '更新时间' })
  @Expose()
  @Transform(({ value }): string =>
    typeof value === 'number' ? new Date(value).toISOString() : value,
  )
  updatedAt: number;
}

/**
 * 管理端用户响应DTO - 包含完整数据
 */
export class AdminUserDto {
  @ApiProperty({ description: '用户ID' })
  @Expose()
  id: string;

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

  @ApiProperty({
    description: '用户状态',
    enum: ['active', 'inactive', 'banned'],
  })
  @Expose()
  status: string;

  @ApiProperty({ description: '用户角色', enum: ['user', 'admin'] })
  @Expose()
  role: string;

  @ApiProperty({ description: '创建时间' })
  @Expose()
  @Transform(({ value }): string =>
    typeof value === 'number' ? new Date(value).toISOString() : value,
  )
  createdAt: number;

  @ApiProperty({ description: '更新时间' })
  @Expose()
  @Transform(({ value }): string =>
    typeof value === 'number' ? new Date(value).toISOString() : value,
  )
  updatedAt: number;

  // 密码永远不返回
  password?: string;
}

/**
 * 管理端文章响应DTO - 包含完整数据
 */
export class AdminArticleDto {
  @ApiProperty({ description: '文章ID' })
  @Expose()
  id: string;

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

  @ApiProperty({
    description: '文章状态',
    enum: ['draft', 'published', 'archived'],
  })
  @Expose()
  status: string;

  @ApiProperty({ description: '作者ID' })
  @Expose()
  authorId: string;

  @ApiProperty({ description: '分类ID' })
  @Expose()
  categoryId: string;

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

  @ApiProperty({ description: '权重' })
  @Expose()
  weight: number;

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

  @ApiProperty({ description: '是否对用户端可见' })
  @Expose()
  isVisible: boolean;

  @ApiProperty({ description: '发布时间' })
  @Expose()
  @Transform(({ value }): string | null =>
    value
      ? typeof value === 'number'
        ? new Date(value).toISOString()
        : value
      : null,
  )
  publishedAt: number | null;

  @ApiProperty({ description: '创建时间' })
  @Expose()
  @Transform(({ value }): string =>
    typeof value === 'number' ? new Date(value).toISOString() : value,
  )
  createdAt: number;

  @ApiProperty({ description: '更新时间' })
  @Expose()
  @Transform(({ value }): string =>
    typeof value === 'number' ? new Date(value).toISOString() : value,
  )
  updatedAt: number;

  @ApiProperty({ description: '作者信息', type: AdminUserDto })
  @Expose()
  @Type(() => AdminUserDto)
  author: AdminUserDto;

  @ApiProperty({ description: '分类信息', type: AdminCategoryDto })
  @Expose()
  @Type(() => AdminCategoryDto)
  category: AdminCategoryDto;

  @ApiProperty({ description: '标签列表', type: [AdminTagDto] })
  @Expose()
  @Type(() => AdminTagDto)
  tags: AdminTagDto[];
}

/**
 * 管理端文章详情响应DTO - 包含内容
 */
export class AdminArticleDetailDto extends AdminArticleDto {
  @ApiProperty({ description: '文章内容' })
  @Expose()
  content: string;
}
