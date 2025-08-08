import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Tag } from '@/entities/tag.entity';
import {
  NotFoundException,
  ConflictException,
} from '@/common/exceptions/business.exception';
import {
  CreateTagDto,
  UpdateTagDto,
  TagQueryDto,
  TagStatsDto,
  PopularTagsDto,
} from '@/dto/tag.dto';
import { PaginatedResponse } from '@/common/interfaces/response.interface';
import { ErrorCode } from '@/common/constants/error-codes';
import { BaseService } from '@/common/base/base.service';
import { CacheStrategyService } from '@/common/cache/cache-strategy.service';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TagService extends BaseService<Tag> {
  constructor(
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    protected readonly cacheStrategy: CacheStrategyService,
    protected readonly logger: StructuredLoggerService,
    protected readonly configService: ConfigService,
  ) {
    super(tagRepository, cacheStrategy, 'tag', configService);
    this.logger.setContext({ module: 'TagService' });
  }

  /**
   * 创建标签（重写BaseService方法以处理slug生成和唯一性检查）
   */
  async create(createTagDto: CreateTagDto): Promise<Tag> {
    const { name, slug, ...tagData } = createTagDto;

    // 检查名称是否已存在
    const existingByName = await this.tagRepository.findOne({
      where: { name },
    });
    if (existingByName) {
      throw new ConflictException(ErrorCode.TAG_NAME_EXISTS);
    }

    // 生成slug
    const finalSlug = slug || this.generateSlug(name);
    const existingBySlug = await this.tagRepository.findOne({
      where: { slug: finalSlug },
    });
    if (existingBySlug) {
      throw new ConflictException(ErrorCode.TAG_NAME_EXISTS, '标签slug已存在');
    }

    const tagCreateData = {
      ...tagData,
      name,
      slug: finalSlug,
    };

    // 使用BaseService的create方法
    const savedTag = await super.create(tagCreateData);
    await this.clearTagCache();
    return savedTag;
  }

  async findAll(query: TagQueryDto): Promise<PaginatedResponse<Tag>> {
    const {
      page = 1,
      limit = 10,
      keyword,
      isActive,
      minPopularity,
      includeStats = false,
      sortBy = 'popularity',
      sortOrder = 'DESC',
    } = query;

    const queryBuilder = this.tagRepository.createQueryBuilder('tag');

    // 过滤已删除的标签
    queryBuilder.where('tag.deletedAt IS NULL');

    if (includeStats) {
      queryBuilder.leftJoinAndSelect('tag.articles', 'articles');
    }

    if (keyword) {
      queryBuilder.andWhere(
        '(tag.name LIKE :keyword OR tag.description LIKE :keyword)',
        { keyword: `%${keyword}%` },
      );
    }

    if (typeof isActive === 'boolean') {
      queryBuilder.andWhere('tag.isActive = :isActive', { isActive });
    }

    if (minPopularity !== undefined) {
      queryBuilder.andWhere('tag.popularity >= :minPopularity', {
        minPopularity,
      });
    }

    // 排序
    const validSortFields = ['popularity', 'name', 'createdAt', 'articleCount'];
    const finalSortBy = validSortFields.includes(sortBy)
      ? sortBy
      : 'popularity';
    queryBuilder.orderBy(`tag.${finalSortBy}`, sortOrder);

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

  /**
   * 根据ID查找标签（重写BaseService方法以包含关联数据）
   */
  async findById(id: string, includeRelations = true): Promise<Tag> {
    if (!includeRelations) {
      return super.findById(id);
    }

    // 使用统一的缓存策略
    const cached = await this.cacheStrategy.get<Tag>(id, {
      type: 'tag',
    });
    if (cached) {
      return cached;
    }

    const tag = await this.tagRepository.findOne({
      where: { id },
      relations: ['articles'],
    });

    if (!tag) {
      throw new NotFoundException(ErrorCode.TAG_NOT_FOUND);
    }

    // 缓存标签信息
    await this.cacheStrategy.set(id, tag, {
      type: 'tag',
      ttl: 1800, // 30分钟
    });

    return tag;
  }

  async findBySlug(slug: string): Promise<Tag> {
    const cacheKey = `tag:slug:${slug}`;
    const cached = await this.cacheManager.get<Tag>(cacheKey);
    if (cached) {
      return cached;
    }

    const tag = await this.tagRepository.findOne({
      where: { slug },
      relations: ['articles'],
    });

    if (!tag) {
      throw new NotFoundException(ErrorCode.TAG_NOT_FOUND);
    }

    await this.cacheManager.set(cacheKey, tag, 300000);
    return tag;
  }

  async findByIds(ids: string[]): Promise<Tag[]> {
    if (!ids || ids.length === 0) {
      return [];
    }

    return this.tagRepository.find({
      where: { id: In(ids), isActive: true },
    });
  }

  async findByNames(names: string[]): Promise<Tag[]> {
    if (!names || names.length === 0) {
      return [];
    }

    return this.tagRepository.find({
      where: { name: In(names), isActive: true },
    });
  }

  /**
   * 更新标签（重写BaseService方法以处理slug冲突检查）
   */
  async update(id: string, updateTagDto: UpdateTagDto): Promise<Tag> {
    const tag = await this.findById(id);
    const { name, slug, ...updateData } = updateTagDto;

    // 检查名称冲突
    if (name && name !== tag.name) {
      const existingByName = await this.tagRepository.findOne({
        where: { name },
      });
      if (existingByName && existingByName.id !== id) {
        throw new ConflictException(ErrorCode.TAG_NAME_EXISTS);
      }
    }

    // 检查slug冲突
    if (slug && slug !== tag.slug) {
      const existingBySlug = await this.tagRepository.findOne({
        where: { slug },
      });
      if (existingBySlug && existingBySlug.id !== id) {
        throw new ConflictException(
          ErrorCode.TAG_NAME_EXISTS,
          '标签slug已存在',
        );
      }
    }

    const updateDataWithValidation = {
      ...updateData,
      ...(name && { name }),
      ...(slug && { slug }),
    };

    // 使用BaseService的update方法
    const updatedTag = await super.update(id, updateDataWithValidation);
    await this.clearTagCache();
    return updatedTag;
  }

  /**
   * 删除标签（重写BaseService方法以处理关联文章检查）
   */
  async remove(id: string): Promise<void> {
    const tag = await this.findById(id);

    // 检查是否有关联文章
    if (tag.articleCount > 0) {
      throw new ConflictException(
        ErrorCode.TAG_IN_USE,
        '存在关联文章，无法删除',
      );
    }

    // 使用BaseService的softRemove方法
    await super.softRemove(id);
    await this.clearTagCache();
  }

  async getPopular(query: PopularTagsDto): Promise<Tag[]> {
    const { limit = 20, days = 30 } = query;
    const cacheKey = `tags:popular:${limit}:${days}`;
    const cached = await this.cacheManager.get<Tag[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const tags = await this.tagRepository
      .createQueryBuilder('tag')
      .where('tag.isActive = :isActive', { isActive: true })
      .andWhere('tag.deletedAt IS NULL')
      .orderBy('tag.popularity', 'DESC')
      .addOrderBy('tag.articleCount', 'DESC')
      .limit(limit)
      .getMany();

    await this.cacheManager.set(cacheKey, tags, 1800000); // 30分钟缓存
    return tags;
  }

  async getStats(): Promise<TagStatsDto[]> {
    const tags = await this.tagRepository
      .createQueryBuilder('tag')
      .select([
        'tag.id',
        'tag.name',
        'tag.articleCount',
        'tag.popularity',
        'tag.color',
      ])
      .where('tag.isActive = :isActive', { isActive: true })
      .andWhere('tag.deletedAt IS NULL')
      .orderBy('tag.articleCount', 'DESC')
      .limit(50)
      .getMany();

    return tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      articleCount: tag.articleCount,
      popularity: tag.popularity,
      color: tag.color,
    }));
  }

  async updateArticleCount(tagId: string): Promise<void> {
    const count = await this.tagRepository
      .createQueryBuilder('tag')
      .leftJoin('tag.articles', 'article')
      .where('tag.id = :tagId', { tagId })
      .andWhere('article.status = :status', { status: 'published' })
      .getCount();

    await this.tagRepository.update(tagId, { articleCount: count });
    await this.clearTagCache();
  }

  async incrementPopularity(
    tagId: string,
    increment: number = 1,
  ): Promise<void> {
    await this.tagRepository.increment({ id: tagId }, 'popularity', increment);
    await this.clearTagCache();
  }

  async createOrFindTags(tagNames: string[]): Promise<Tag[]> {
    if (!tagNames || tagNames.length === 0) {
      return [];
    }

    const existingTags = await this.findByNames(tagNames);
    const existingTagNames = existingTags.map((tag) => tag.name);
    const newTagNames = tagNames.filter(
      (name) => !existingTagNames.includes(name),
    );

    const newTags: Tag[] = [];
    for (const name of newTagNames) {
      const tag = this.tagRepository.create({
        name,
        slug: this.generateSlug(name),
        isActive: true,
      });
      const savedTag = await this.tagRepository.save(tag);
      newTags.push(savedTag);
    }

    await this.clearTagCache();
    return [...existingTags, ...newTags];
  }

  async getTagCloud(): Promise<
    { name: string; count: number; weight: number }[]
  > {
    const cacheKey = 'tags:cloud';
    const cached = await this.cacheManager.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const tags = await this.tagRepository
      .createQueryBuilder('tag')
      .select(['tag.name', 'tag.articleCount'])
      .where('tag.isActive = :isActive', { isActive: true })
      .andWhere('tag.deletedAt IS NULL')
      .andWhere('tag.articleCount > 0')
      .orderBy('tag.articleCount', 'DESC')
      .limit(100)
      .getMany();

    const maxCount = Math.max(...tags.map((tag) => tag.articleCount));
    const minCount = Math.min(...tags.map((tag) => tag.articleCount));

    const tagCloud = tags.map((tag) => ({
      name: tag.name,
      count: tag.articleCount,
      weight: this.calculateWeight(tag.articleCount, minCount, maxCount),
    }));

    await this.cacheManager.set(cacheKey, tagCloud, 1800000); // 30分钟缓存
    return tagCloud;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private calculateWeight(count: number, min: number, max: number): number {
    if (max === min) return 1;
    return Math.round(((count - min) / (max - min)) * 4) + 1; // 1-5的权重
  }

  private async clearTagCache(): Promise<void> {
    try {
      // 使用统一的缓存策略清除相关缓存
      await this.cacheStrategy.clearByTags(['tag', 'content']);

      // 清除特定的缓存键（这些键不遵循标准前缀模式）
      const specificKeys = ['tags:cloud'];

      const deletePromises = specificKeys.map((key) =>
        this.cacheManager
          .del(key)
          .catch((err) =>
            console.warn(`Failed to delete cache key ${key}:`, err),
          ),
      );

      // 清除按模式匹配的键
      const patterns = ['tags:popular:*', 'tag:slug:*'];

      for (const pattern of patterns) {
        deletePromises.push(
          this.cacheStrategy
            .clearCacheByPattern(pattern)
            .catch((err) =>
              console.warn(`Failed to clear cache pattern ${pattern}:`, err),
            ),
        );
      }

      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Failed to clear tag cache:', error);
    }
  }
}
