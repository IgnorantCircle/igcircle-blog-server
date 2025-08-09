import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '@/entities/category.entity';
import {
  NotFoundException,
  ConflictException,
} from '@/common/exceptions/business.exception';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryQueryDto,
  CategoryStatsDto,
} from '@/dto/category.dto';
import { ArticleStatus } from '@/dto/article.dto';
import { PaginatedResponse } from '@/common/interfaces/response.interface';
import { ErrorCode } from '@/common/constants/error-codes';
import { BaseService } from '@/common/base/base.service';
import { SlugUtil } from '@/common/utils/slug.util';
import { CACHE_TYPES } from '@/common/cache/cache.config';
import { CacheService } from '@/common/cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';
import { PaginationUtil } from '@/common/utils/pagination.util';

@Injectable()
export class CategoryService extends BaseService<Category> {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @Inject(CacheService) cacheService: CacheService,
    @Inject(ConfigService) configService: ConfigService,
    @Inject(StructuredLoggerService) logger: StructuredLoggerService,
  ) {
    super(categoryRepository, 'category', cacheService, configService, logger);
    this.logger.setContext({ module: 'CategoryService' });
  }

  /**
   * 创建分类（重写BaseService方法以处理父分类验证）
   */
  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const { name, slug, parentId, ...categoryData } = createCategoryDto;

    // 检查名称是否已存在
    const existingByName = await this.categoryRepository.findOne({
      where: { name },
    });
    if (existingByName) {
      throw new ConflictException(ErrorCode.CATEGORY_NAME_EXISTS);
    }

    // 生成slug
    const finalSlug = slug || SlugUtil.forCategory(name || 'category');
    const existingBySlug = await this.categoryRepository.findOne({
      where: { slug: finalSlug },
    });
    if (existingBySlug) {
      throw new ConflictException(
        ErrorCode.CATEGORY_NAME_EXISTS,
        '分类slug已存在',
      );
    }

    // 验证父分类
    if (parentId) {
      const parent = await this.categoryRepository.findOne({
        where: { id: parentId },
      });
      if (!parent) {
        throw new NotFoundException(ErrorCode.CATEGORY_NOT_FOUND);
      }
    }

    const categoryCreateData = {
      ...categoryData,
      name,
      slug: finalSlug,
      parentId,
    };

    // 使用BaseService的create方法
    const savedCategory = await super.create(categoryCreateData);
    await this.clearCategoryCache();
    return savedCategory;
  }

  async findAllPaginated(
    query: CategoryQueryDto,
  ): Promise<PaginatedResponse<Category>> {
    const {
      page = 1,
      limit = 10,
      keyword,
      isActive,
      parentId,
      includeChildren = false,
      sortBy = 'sortOrder',
      sortOrder = 'ASC',
    } = query;

    const queryBuilder = this.categoryRepository
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.parent', 'parent')
      .where('category.deletedAt IS NULL');

    if (includeChildren) {
      queryBuilder.leftJoinAndSelect('category.children', 'children');
    }

    if (keyword) {
      queryBuilder.andWhere(
        '(category.name LIKE :keyword OR category.description LIKE :keyword)',
        { keyword: `%${keyword}%` },
      );
    }

    if (typeof isActive === 'boolean') {
      queryBuilder.andWhere('category.isActive = :isActive', { isActive });
    }

    if (parentId !== undefined) {
      if (parentId === null) {
        queryBuilder.andWhere('category.parentId IS NULL');
      } else {
        queryBuilder.andWhere('category.parentId = :parentId', { parentId });
      }
    }

    // 排序
    const validSortFields = ['sortOrder', 'name', 'createdAt', 'articleCount'];
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'sortOrder';
    queryBuilder.orderBy(`category.${finalSortBy}`, sortOrder);

    const [items, total] = await queryBuilder
      .skip(PaginationUtil.calculateSkip(page, limit))
      .take(limit)
      .getManyAndCount();

    return PaginationUtil.fromTypeOrmResult([items, total], page, limit);
  }

  /**
   * 根据ID查找分类（重写BaseService方法以包含关联数据）
   */
  async findById(id: string, includeRelations = true): Promise<Category> {
    if (!includeRelations) {
      const category = await super.findById(id);
      if (!category) {
        throw new NotFoundException(ErrorCode.CATEGORY_NOT_FOUND);
      }
      return category;
    }

    // 使用统一的缓存策略
    const cached = await this.cacheService.get<Category>(id, {
      type: CACHE_TYPES.CATEGORY,
    });
    if (cached) {
      return cached;
    }

    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });

    if (!category) {
      throw new NotFoundException(ErrorCode.CATEGORY_NOT_FOUND);
    }

    // 缓存分类信息
    await this.cacheService.set(id, category, {
      type: CACHE_TYPES.CATEGORY,
    });

    return category;
  }

  async findBySlug(slug: string): Promise<Category> {
    const cacheKey = `category:slug:${slug}`;
    const cached = await this.cacheService.get<Category>(cacheKey, {
      type: CACHE_TYPES.CATEGORY,
    });
    if (cached) {
      return cached;
    }

    const category = await this.categoryRepository.findOne({
      where: { slug },
      relations: ['parent', 'children'],
    });

    if (!category) {
      throw new NotFoundException(ErrorCode.CATEGORY_NOT_FOUND);
    }

    await this.cacheService.set(cacheKey, category, {
      type: CACHE_TYPES.CATEGORY,
    });
    return category;
  }

  /**
   * 更新分类（重写BaseService方法以处理冲突和父分类验证）
   */
  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findById(id);
    const { name, slug, parentId, ...updateData } = updateCategoryDto;

    // 检查名称冲突
    if (name && name !== category.name) {
      const existingByName = await this.categoryRepository.findOne({
        where: { name },
      });
      if (existingByName && existingByName.id !== id) {
        throw new ConflictException(ErrorCode.CATEGORY_NAME_EXISTS);
      }
    }

    // 检查slug冲突
    if (slug && slug !== category.slug) {
      const existingBySlug = await this.categoryRepository.findOne({
        where: { slug },
      });
      if (existingBySlug && existingBySlug.id !== id) {
        throw new ConflictException(
          ErrorCode.CATEGORY_NAME_EXISTS,
          '分类slug已存在',
        );
      }
    }

    // 验证父分类（防止循环引用）
    if (parentId !== undefined && parentId !== category.parentId) {
      if (parentId === id) {
        throw new ConflictException(
          ErrorCode.CATEGORY_INVALID_PARENT,
          '不能将自己设为父分类',
        );
      }
      if (parentId && (await this.isDescendant(id, parentId))) {
        throw new ConflictException(
          ErrorCode.CATEGORY_INVALID_PARENT,
          '不能将子分类设为父分类',
        );
      }
    }

    const updateDataWithValidation = {
      ...updateData,
      ...(name && { name }),
      ...(slug && { slug }),
      ...(parentId !== undefined && { parentId }),
    };

    // 使用BaseService的update方法
    const updatedCategory = await super.update(id, updateDataWithValidation);
    await this.clearCategoryCache();
    return updatedCategory;
  }

  /**
   * 删除分类（重写BaseService方法以处理子分类和关联文章检查）
   */
  async remove(id: string): Promise<void> {
    const category = await this.findById(id);

    // 检查是否有子分类
    const childrenCount = await this.categoryRepository.count({
      where: { parentId: id },
    });
    if (childrenCount > 0) {
      throw new ConflictException(
        ErrorCode.CATEGORY_HAS_ARTICLES,
        '存在子分类，无法删除',
      );
    }

    // 检查是否有关联文章
    if (category.articleCount > 0) {
      throw new ConflictException(
        ErrorCode.CATEGORY_HAS_ARTICLES,
        '存在关联文章，无法删除',
      );
    }

    // 使用BaseService的softRemove方法
    await super.remove(id);
    await this.clearCategoryCache();
  }

  async getTree(): Promise<Category[]> {
    const cacheKey = 'category:tree';
    const cached = await this.cacheService.get<Category[]>(cacheKey, {
      type: CACHE_TYPES.CATEGORY,
    });
    if (cached) {
      return cached;
    }

    const categories = await this.categoryRepository.find({
      where: { isActive: true },
      relations: ['children'],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    const tree = this.buildTree(categories);
    await this.cacheService.set(cacheKey, tree, {
      type: CACHE_TYPES.CATEGORY,
    });
    return tree;
  }

  async getStats(): Promise<CategoryStatsDto[]> {
    interface CategoryStatsRaw {
      category_id: string;
      category_name: string;
      category_articleCount: string;
      childrenCount: string;
    }

    const categories = await this.categoryRepository
      .createQueryBuilder('category')
      .leftJoin('category.children', 'children')
      .where('category.deletedAt IS NULL')
      .andWhere('(children.deletedAt IS NULL OR children.id IS NULL)')
      .select([
        'category.id',
        'category.name',
        'category.articleCount',
        'COUNT(children.id) as childrenCount',
      ])
      .groupBy('category.id')
      .orderBy('category.articleCount', 'DESC')
      .getRawMany<CategoryStatsRaw>();

    return categories.map((cat) => ({
      id: cat.category_id,
      name: cat.category_name,
      articleCount: parseInt(cat.category_articleCount, 10) || 0,
      childrenCount: parseInt(cat.childrenCount, 10) || 0,
    }));
  }

  async updateArticleCount(categoryId: string): Promise<void> {
    const count = await this.categoryRepository
      .createQueryBuilder('category')
      .leftJoin('category.articles', 'article')
      .where('category.id = :categoryId', { categoryId })
      .andWhere('category.deletedAt IS NULL')
      .andWhere('article.status = :status', { status: ArticleStatus.PUBLISHED })
      .andWhere('article.deletedAt IS NULL')
      .getCount();

    await this.categoryRepository.update(categoryId, { articleCount: count });
    await this.clearCategoryCache();
  }

  async findOrCreate(name: string): Promise<Category> {
    // 先尝试查找现有分类
    const existingCategory = await this.categoryRepository.findOne({
      where: { name },
    });

    if (existingCategory) {
      return existingCategory;
    }

    // 如果不存在，创建新分类
    const slug = SlugUtil.forCategory(name);
    const category = this.categoryRepository.create({
      name,
      slug,
      description: '',
      isActive: true,
      articleCount: 0,
    });

    const savedCategory = await this.categoryRepository.save(category);
    await this.clearCategoryCache();
    return savedCategory;
  }

  private async isDescendant(
    ancestorId: string,
    descendantId: string,
  ): Promise<boolean> {
    const descendant = await this.categoryRepository.findOne({
      where: { id: descendantId },
      relations: ['parent'],
    });

    if (!descendant || !descendant.parent) {
      return false;
    }

    if (descendant.parent.id === ancestorId) {
      return true;
    }

    return this.isDescendant(ancestorId, descendant.parent.id);
  }

  private buildTree(categories: Category[]): Category[] {
    const categoryMap = new Map<string, Category>();
    const rootCategories: Category[] = [];

    // 创建映射
    categories.forEach((category) => {
      categoryMap.set(category.id, { ...category, children: [] });
    });

    // 构建树结构
    categories.forEach((category) => {
      const categoryNode = categoryMap.get(category.id);
      if (categoryNode) {
        if (category.parentId) {
          const parent = categoryMap.get(category.parentId);
          if (parent) {
            parent.children.push(categoryNode);
          }
        } else {
          rootCategories.push(categoryNode);
        }
      }
    });

    return rootCategories;
  }

  private async clearCategoryCache(): Promise<void> {
    // 使用统一的缓存策略清除相关缓存
    await this.cacheService.clearByType(CACHE_TYPES.CATEGORY);
  }
}
