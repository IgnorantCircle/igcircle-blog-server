import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

/**
 * 公共分类响应DTO
 */
export class PublicCategoryDto {
  @ApiProperty({ description: '分类ID' })
  @Expose()
  id: string;

  @ApiProperty({ description: '分类名称' })
  @Expose()
  name: string;

  @ApiProperty({ description: '分类描述' })
  @Expose()
  description: string;

  @ApiProperty({ description: '分类图标' })
  @Expose()
  icon: string;

  @ApiProperty({ description: '文章数量' })
  @Expose()
  articleCount: number;

  // 管理信息不暴露
  @Exclude()
  slug: string;

  @Exclude()
  sort: number;

  @Exclude()
  isVisible: boolean;

  @Exclude()
  isActive: boolean;

  @Exclude()
  createdAt: number;

  @Exclude()
  updatedAt: number;
}

/**
 * 公共标签响应DTO
 */
export class PublicTagDto {
  @ApiProperty({ description: '标签ID' })
  @Expose()
  id: string;

  @ApiProperty({ description: '标签名称' })
  @Expose()
  name: string;

  @ApiProperty({ description: '标签颜色' })
  @Expose()
  color: string;

  @ApiProperty({ description: '文章数量' })
  @Expose()
  articleCount: number;

  // 管理信息不暴露
  @Exclude()
  description: string;

  @Exclude()
  sort: number;

  @Exclude()
  isVisible: boolean;

  @Exclude()
  isActive: boolean;

  @Exclude()
  createdAt: number;

  @Exclude()
  updatedAt: number;
}

/**
 * 公共API响应基类 - 用户端API返回的脱敏数据
 */
export class PublicUserDto {
  @ApiProperty({ description: '用户ID' })
  @Expose()
  id: string;

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
  @Transform(({ value }: { value: number | string }) =>
    typeof value === 'number' ? new Date(value).toISOString() : value,
  )
  createdAt: number;

  // 敏感信息不暴露给公共API
  @Exclude()
  email: string;

  @Exclude()
  password: string;

  @Exclude()
  role: string;

  @Exclude()
  status: string;

  @Exclude()
  updatedAt: number;
}

/**
 * 公共文章响应DTO - 用户端API返回的精简数据
 */
export class PublicArticleDto {
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

  @ApiProperty({ description: '发布时间' })
  @Expose()
  @Transform(({ value }: { value: number | string | null }) =>
    value
      ? typeof value === 'number'
        ? new Date(value).toISOString()
        : value
      : null,
  )
  publishedAt: number | null;

  @ApiProperty({ description: '作者信息', type: PublicUserDto })
  @Expose()
  @Transform(({ value }) => (value ? new PublicUserDto() : null))
  author: PublicUserDto;

  weight: number;

  @Exclude()
  metaDescription: string;

  @Exclude()
  metaKeywords: string[];

  @Exclude()
  socialImage: string;

  @Exclude()
  allowComment: boolean;

  @Exclude()
  isVisible: boolean;

  @Exclude()
  createdAt: number;

  @Exclude()
  updatedAt: number;
}

/**
 * 公共文章详情响应DTO - 包含内容
 */
export class PublicArticleDetailDto extends PublicArticleDto {
  @ApiProperty({ description: '文章内容' })
  @Expose()
  content: string;

  @ApiProperty({ description: '标签列表', type: [PublicTagDto] })
  @Expose()
  @Transform(
    ({
      value,
    }: {
      value: Array<{
        id: string;
        name: string;
        color: string;
        articleCount: number;
        isActive: boolean;
      }> | null;
    }) => {
      if (!value || !Array.isArray(value)) return [];
      return value
        .filter((tag) => tag.isActive)
        .map((tag) => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          articleCount: tag.articleCount,
        }));
    },
  )
  tags: PublicTagDto[];

  @ApiProperty({ description: '分类信息', type: PublicCategoryDto })
  @Expose()
  @Transform(
    ({
      value,
    }: {
      value: {
        id: string;
        name: string;
        description: string;
        icon: string;
        articleCount: number;
        isActive: boolean;
      } | null;
    }) => {
      if (!value || !value.isActive) return null;
      return {
        id: value.id,
        name: value.name,
        description: value.description,
        icon: value.icon,
        articleCount: value.articleCount,
      };
    },
  )
  category: PublicCategoryDto | null;
}
