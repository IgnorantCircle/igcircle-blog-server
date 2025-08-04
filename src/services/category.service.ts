import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
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
import { PaginatedResponse } from '@/common/interfaces/response.interface';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const { name, slug, parentId, ...categoryData } = createCategoryDto;

    // 检查名称是否已存在
    const existingByName = await this.categoryRepository.findOne({
      where: { name },
    });
    if (existingByName) {
      throw new ConflictException('分类名称已存在');
    }

    // 生成slug
    const finalSlug = slug || this.generateSlug(name);
    const existingBySlug = await this.categoryRepository.findOne({
      where: { slug: finalSlug },
    });
    if (existingBySlug) {
      throw new ConflictException('分类slug已存在');
    }

    // 验证父分类
    if (parentId) {
      const parent = await this.categoryRepository.findOne({
        where: { id: parentId },
      });
      if (!parent) {
        throw new NotFoundException('父分类不存在');
      }
    }

    const category = this.categoryRepository.create({
      ...categoryData,
      name,
      slug: finalSlug,
      parentId,
    });

    const savedCategory = await this.categoryRepository.save(category);
    await this.clearCategoryCache();
    return savedCategory;
  }

  async findAll(query: CategoryQueryDto): Promise<PaginatedResponse<Category>> {
    const {
      page = 1,
      limit = 10,
      name,
      isActive,
      parentName,
      includeChildren = false,
      sortBy = 'levelShow',
      sortOrder = 'ASC',
      description,
    } = query;

    const queryBuilder = this.categoryRepository
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.parent', 'parent');

    if (includeChildren) {
      queryBuilder.leftJoinAndSelect('category.children', 'children');
    }

    if (name) {
      queryBuilder.andWhere('(category.name LIKE :name)', {
        name: `%${name}%`,
      });
    }

    if (description) {
      queryBuilder.andWhere('category.description LIKE :description', {
        description: `%${description}%`,
      });
    }

    if (typeof isActive === 'boolean') {
      queryBuilder.andWhere('category.isActive = :isActive', { isActive });
    }

    // 处理parentName查询条件
    if (parentName !== undefined) {
      if (parentName === null) {
        queryBuilder.andWhere('category.parentId IS NULL');
      } else {
        // 直接通过联表查询实现parentName模糊匹配
        queryBuilder.andWhere('parent.name LIKE :parentName', {
          parentName: `%${parentName}%`,
        });
      }
    }

    // 排序
    const validSortFields = ['levelShow', 'name', 'createdAt', 'articleCount'];
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'levelShow';
    queryBuilder.orderBy(`category.${finalSortBy}`, sortOrder);

    const [items, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };
  }

  async findById(id: string): Promise<Category> {
    const cacheKey = `category:${id}`;
    const cached = await this.cacheManager.get<Category>(cacheKey);
    if (cached) {
      return cached;
    }

    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });

    if (!category) {
      throw new NotFoundException('分类不存在');
    }

    await this.cacheManager.set(cacheKey, category, 300000); // 5分钟缓存
    return category;
  }

  async findBySlug(slug: string): Promise<Category> {
    const cacheKey = `category:slug:${slug}`;
    const cached = await this.cacheManager.get<Category>(cacheKey);
    if (cached) {
      return cached;
    }

    const category = await this.categoryRepository.findOne({
      where: { slug },
      relations: ['parent', 'children'],
    });

    if (!category) {
      throw new NotFoundException('分类不存在');
    }

    await this.cacheManager.set(cacheKey, category, 300000);
    return category;
  }

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
        throw new ConflictException('分类名称已存在');
      }
    }

    // 检查slug冲突
    if (slug && slug !== category.slug) {
      const existingBySlug = await this.categoryRepository.findOne({
        where: { slug },
      });
      if (existingBySlug && existingBySlug.id !== id) {
        throw new ConflictException('分类slug已存在');
      }
    }

    // 验证父分类（防止循环引用）
    if (parentId !== undefined && parentId !== category.parentId) {
      if (parentId === id) {
        throw new ConflictException('不能将自己设为父分类');
      }
      if (parentId && (await this.isDescendant(id, parentId))) {
        throw new ConflictException('不能将子分类设为父分类');
      }
    }

    Object.assign(category, {
      ...updateData,
      ...(name && { name }),
      ...(slug && { slug }),
      ...(parentId !== undefined && { parentId }),
    });

    const updatedCategory = await this.categoryRepository.save(category);
    await this.clearCategoryCache();
    return updatedCategory;
  }

  async remove(id: string): Promise<void> {
    const category = await this.findById(id);

    // 检查是否有子分类
    const childrenCount = await this.categoryRepository.count({
      where: { parentId: id },
    });
    if (childrenCount > 0) {
      throw new ConflictException('存在子分类，无法删除');
    }

    // 检查是否有关联文章
    if (category.articleCount > 0) {
      throw new ConflictException('存在关联文章，无法删除');
    }

    await this.categoryRepository.remove(category);
    await this.clearCategoryCache();
  }

  async getTree(): Promise<Category[]> {
    const cacheKey = 'category:tree';
    const cached = await this.cacheManager.get<Category[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const categories = await this.categoryRepository.find({
      where: { isActive: true },
      relations: ['children'],
      order: { levelShow: 'ASC', name: 'ASC' },
    });

    const tree = this.buildTree(categories);
    await this.cacheManager.set(cacheKey, tree, 600000); // 10分钟缓存
    return tree;
  }

  async getStats(): Promise<CategoryStatsDto[]> {
    const categories = await this.categoryRepository
      .createQueryBuilder('category')
      .leftJoin('category.children', 'children')
      .select([
        'category.id',
        'category.name',
        'category.articleCount',
        'COUNT(children.id) as childrenCount',
      ])
      .groupBy('category.id')
      .orderBy('category.articleCount', 'DESC')
      .getRawMany();

    return categories.map((cat) => ({
      id: cat.category_id,
      name: cat.category_name,
      articleCount: cat.category_articleCount,
      childrenCount: parseInt(cat.childrenCount) || 0,
    }));
  }

  async updateArticleCount(categoryId: string): Promise<void> {
    const count = await this.categoryRepository
      .createQueryBuilder('category')
      .leftJoin('category.articles', 'article')
      .where('category.id = :categoryId', { categoryId })
      .andWhere('article.status = :status', { status: 'published' })
      .getCount();

    await this.categoryRepository.update(categoryId, { articleCount: count });
    await this.clearCategoryCache();
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
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
    const keys = ['category:tree', 'category:*'];
    for (const key of keys) {
      await this.cacheManager.del(key);
    }
  }
}
