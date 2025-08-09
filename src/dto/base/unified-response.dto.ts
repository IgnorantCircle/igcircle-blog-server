import {
  PublicField,
  AdminField,
  UserField,
  TimeField,
  StatsField,
  RelationField,
  RelationArrayField,
  SensitiveField,
  VisibilityContext,
} from '@/common/decorators/field-visibility.decorator';

/**
 * 统一的基础实体响应DTO
 * 使用字段可见性装饰器动态控制字段显示
 */
export abstract class UnifiedBaseEntityDto {
  @PublicField({
    description: 'ID',
    type: String,
  })
  id: string;

  @TimeField(
    [VisibilityContext.PUBLIC, VisibilityContext.ADMIN, VisibilityContext.USER],
    {
      description: '创建时间',
    },
  )
  createdAt: string;

  @TimeField([VisibilityContext.ADMIN, VisibilityContext.USER], {
    description: '更新时间',
  })
  updatedAt: string;
}

/**
 * 统一的分类响应DTO
 */
export class UnifiedCategoryDto extends UnifiedBaseEntityDto {
  @PublicField({
    description: '分类名称',
    type: String,
  })
  name: string;

  @PublicField({
    description: '分类描述',
    type: String,
    optional: true,
  })
  description: string;

  @PublicField({
    description: '分类图标',
    type: String,
    optional: true,
  })
  icon: string;

  @AdminField({
    description: '分类slug',
    type: String,
  })
  slug: string;

  @AdminField({
    description: '分类颜色',
    type: String,
    optional: true,
  })
  color: string;

  @AdminField({
    description: '排序权重',
    type: Number,
  })
  sortOrder: number;

  @AdminField({
    description: '是否可见',
    type: Boolean,
  })
  isVisible: boolean;

  @AdminField({
    description: '是否激活',
    type: Boolean,
  })
  isActive: boolean;

  @StatsField([VisibilityContext.PUBLIC, VisibilityContext.ADMIN], {
    description: '文章数量',
  })
  articleCount: number;

  @AdminField({
    description: '父分类ID',
    type: String,
    optional: true,
  })
  parentId: string;

  @RelationArrayField(() => UnifiedCategoryDto, [VisibilityContext.ADMIN], {
    description: '子分类列表',
    optional: true,
  })
  children: UnifiedCategoryDto[];
}

/**
 * 统一的标签响应DTO
 */
export class UnifiedTagDto extends UnifiedBaseEntityDto {
  @PublicField({
    description: '标签名称',
    type: String,
  })
  name: string;

  @PublicField({
    description: '标签颜色',
    type: String,
  })
  color: string;

  @AdminField({
    description: '标签描述',
    type: String,
    optional: true,
  })
  description: string;

  @AdminField({
    description: '标签slug',
    type: String,
  })
  slug: string;

  @AdminField({
    description: '排序权重',
    type: Number,
  })
  sort: number;

  @AdminField({
    description: '是否可见',
    type: Boolean,
  })
  isVisible: boolean;

  @AdminField({
    description: '是否激活',
    type: Boolean,
  })
  isActive: boolean;

  @StatsField([VisibilityContext.PUBLIC, VisibilityContext.ADMIN], {
    description: '文章数量',
  })
  articleCount: number;

  @StatsField([VisibilityContext.ADMIN], {
    description: '热度',
  })
  popularity: number;
}

/**
 * 统一的用户响应DTO
 */
export class UnifiedUserDto extends UnifiedBaseEntityDto {
  @PublicField({
    description: '用户名',
    type: String,
  })
  username: string;

  @UserField({
    description: '邮箱',
    type: String,
  })
  email: string;

  @PublicField({
    description: '昵称',
    type: String,
  })
  nickname: string;

  @PublicField({
    description: '头像',
    type: String,
    optional: true,
  })
  avatar: string;

  @PublicField({
    description: '个人简介',
    type: String,
    optional: true,
  })
  bio: string;

  @AdminField({
    description: '用户状态',
    type: String,
  })
  status: string;

  @AdminField({
    description: '用户角色',
    type: String,
  })
  role: string;

  @AdminField({
    description: '在线状态',
    type: String,
  })
  onlineStatus: string;

  @TimeField([VisibilityContext.ADMIN], {
    description: '最后活跃时间',
    optional: true,
  })
  lastActiveAt: string | null;

  @SensitiveField()
  password: string;
}

/**
 * 统一的文章响应DTO
 */
export class UnifiedArticleDto extends UnifiedBaseEntityDto {
  @PublicField({
    description: '文章标题',
    type: String,
  })
  title: string;

  @PublicField({
    description: '文章摘要',
    type: String,
  })
  summary: string;

  @PublicField({
    description: '文章slug',
    type: String,
  })
  slug: string;

  @PublicField({
    description: '封面图片',
    type: String,
    optional: true,
  })
  coverImage: string;

  @AdminField({
    description: '文章状态',
    type: String,
  })
  status: string;

  @AdminField({
    description: '作者ID',
    type: String,
  })
  authorId: string;

  @AdminField({
    description: '分类ID',
    type: String,
    optional: true,
  })
  categoryId: string;

  @PublicField({
    description: '阅读时间（分钟）',
    type: Number,
  })
  readingTime: number;

  @PublicField({
    description: '浏览次数',
    type: Number,
  })
  viewCount: number;

  @PublicField({
    description: '点赞数',
    type: Number,
  })
  likeCount: number;

  @PublicField({
    description: '分享数',
    type: Number,
  })
  shareCount: number;

  @PublicField({
    description: '是否精选',
    type: Boolean,
  })
  isFeatured: boolean;

  @PublicField({
    description: '是否置顶',
    type: Boolean,
  })
  isTop: boolean;

  @AdminField({
    description: '权重',
    type: Number,
  })
  weight: number;

  @AdminField({
    description: 'SEO描述',
    type: String,
    optional: true,
  })
  metaDescription: string;

  @AdminField({
    description: 'SEO关键词',
    type: [String],
    isArray: true,
    optional: true,
  })
  metaKeywords: string[];

  @AdminField({
    description: '社交分享图片',
    type: String,
    optional: true,
  })
  socialImage: string;

  @AdminField({
    description: '是否允许评论',
    type: Boolean,
  })
  allowComment: boolean;

  @AdminField({
    description: '是否对用户端可见',
    type: Boolean,
  })
  isVisible: boolean;

  @TimeField([VisibilityContext.PUBLIC, VisibilityContext.ADMIN], {
    description: '发布时间',
    optional: true,
  })
  publishedAt: string | null;

  @RelationField(
    () => UnifiedUserDto,
    [VisibilityContext.PUBLIC, VisibilityContext.ADMIN],
    {
      description: '作者信息',
    },
  )
  author: UnifiedUserDto;

  @RelationField(
    () => UnifiedCategoryDto,
    [VisibilityContext.PUBLIC, VisibilityContext.ADMIN],
    {
      description: '分类信息',
      optional: true,
    },
  )
  category: UnifiedCategoryDto | null;

  @RelationArrayField(
    () => UnifiedTagDto,
    [VisibilityContext.PUBLIC, VisibilityContext.ADMIN],
    {
      description: '标签列表',
    },
  )
  tags: UnifiedTagDto[];
}

/**
 * 统一的文章详情响应DTO
 */
export class UnifiedArticleDetailDto extends UnifiedArticleDto {
  @PublicField({
    description: '文章内容',
    type: String,
  })
  content: string;
}

/**
 * 统一的评论响应DTO
 */
export class UnifiedCommentDto extends UnifiedBaseEntityDto {
  @PublicField({
    description: '评论内容',
    type: String,
  })
  content: string;

  @PublicField({
    description: '文章ID',
    type: String,
  })
  articleId: string;

  @PublicField({
    description: '父评论ID',
    type: String,
    optional: true,
  })
  parentId: string;

  @AdminField({
    description: '评论状态',
    type: String,
  })
  status: string;

  @AdminField({
    description: '是否置顶',
    type: Boolean,
  })
  isTop: boolean;

  @AdminField({
    description: '管理员备注',
    type: String,
    optional: true,
  })
  adminNote: string;

  @PublicField({
    description: '点赞数',
    type: Number,
  })
  likeCount: number;

  @PublicField({
    description: '回复数',
    type: Number,
  })
  replyCount: number;

  @RelationField(
    () => UnifiedUserDto,
    [VisibilityContext.PUBLIC, VisibilityContext.ADMIN],
    {
      description: '评论作者',
    },
  )
  author: UnifiedUserDto;

  @RelationArrayField(
    () => UnifiedCommentDto,
    [VisibilityContext.PUBLIC, VisibilityContext.ADMIN],
    {
      description: '回复列表',
      optional: true,
    },
  )
  replies: UnifiedCommentDto[];
}
