import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
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
import { ArticleStatus } from '@/dto/article.dto';
import { PaginatedResponse } from '@/common/interfaces/response.interface';
import { ErrorCode } from '@/common/constants/error-codes';
import { BaseService } from '@/common/base/base.service';
import { SlugUtil } from '@/common/utils/slug.util';
import { ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';
import { PaginationUtil } from '@/common/utils/pagination.util';
import { BlogCacheService } from '@/common/cache/blog-cache.service';

@Injectable()
export class TagService extends BaseService<Tag> {
  constructor(
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @Inject(ConfigService) configService: ConfigService,
    @Inject(StructuredLoggerService) logger: StructuredLoggerService,
    @Inject(BlogCacheService)
    private readonly blogCacheService: BlogCacheService,
  ) {
    super(tagRepository, 'tag', configService, logger);
    this.logger.setContext({ module: 'TagService' });
  }

  /**
   * 创建标签（重写BaseService方法以处理唯一性检查）
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
    const finalSlug = slug || SlugUtil.forTag(name || 'tag');
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

    // 清除标签缓存
    await this.blogCacheService.clearTagCache();

    return savedTag;
  }

  async findAllPaginated(query: TagQueryDto): Promise<PaginatedResponse<Tag>> {
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
      .skip(PaginationUtil.calculateSkip(page, limit))
      .take(limit)
      .getManyAndCount();

    return PaginationUtil.fromTypeOrmResult([items, total], page, limit);
  }

  /**
   * 获取所有标签（带缓存）
   */
  async findAll(): Promise<Tag[]> {
    // 尝试从缓存获取
    const cached = await this.blogCacheService.getAllTags();
    if (cached && Array.isArray(cached)) {
      return cached as Tag[];
    }

    // 从数据库查询
    const tags = await this.tagRepository.find({
      where: { isActive: true },
      order: { popularity: 'DESC', name: 'ASC' },
    });

    // 缓存结果
    await this.blogCacheService.setAllTags(tags);

    return tags;
  }

  /**
   * 根据ID查找标签（重写BaseService方法以包含关联数据）
   */
  async findById(id: string, includeRelations = true): Promise<Tag> {
    if (!includeRelations) {
      const tag = await super.findById(id);
      if (!tag) {
        throw new NotFoundException(ErrorCode.TAG_NOT_FOUND);
      }
      return tag;
    }

    const tag = await this.tagRepository.findOne({
      where: { id },
      relations: ['articles'],
    });

    if (!tag) {
      throw new NotFoundException(ErrorCode.TAG_NOT_FOUND);
    }

    return tag;
  }

  async findBySlug(slug: string): Promise<Tag> {
    const tag = await this.tagRepository.findOne({
      where: { slug },
      relations: ['articles'],
    });

    if (!tag) {
      throw new NotFoundException(ErrorCode.TAG_NOT_FOUND);
    }

    return tag;
  }

  async findByIds(ids: string[]): Promise<Tag[]> {
    if (!ids || ids.length === 0) {
      return [] as Tag[];
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
   * 更新标签（重写BaseService方法以处理冲突检查）
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

    // 清除标签缓存
    await this.blogCacheService.clearTagCache();

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
    await super.remove(id);
  }

  async getPopular(query: PopularTagsDto): Promise<Tag[]> {
    const { limit = 20, days = 30 } = query;

    // 计算时间范围
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    const tags = await this.tagRepository
      .createQueryBuilder('tag')
      .where('tag.isActive = :isActive', { isActive: true })
      .andWhere('tag.deletedAt IS NULL')
      .andWhere('tag.updatedAt >= :dateThreshold', { dateThreshold })
      .orderBy('tag.popularity', 'DESC')
      .addOrderBy('tag.articleCount', 'DESC')
      .limit(limit)
      .getMany();

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
      .andWhere('article.status = :status', { status: ArticleStatus.PUBLISHED })
      .getCount();

    await this.tagRepository.update(tagId, { articleCount: count });
  }

  async incrementPopularity(
    tagId: string,
    increment: number = 1,
  ): Promise<void> {
    await this.tagRepository.increment({ id: tagId }, 'popularity', increment);
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
        slug: SlugUtil.forTag(name),
        isActive: true,
      });
      const savedTag = await this.tagRepository.save(tag);
      newTags.push(savedTag);
    }

    return [...existingTags, ...newTags];
  }

  async getTagCloud(): Promise<
    { name: string; count: number; weight: number }[]
  > {
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

    return tagCloud;
  }

  private calculateWeight(count: number, min: number, max: number): number {
    if (max === min) return 1;
    return Math.round(((count - min) / (max - min)) * 4) + 1; // 1-5的权重
  }
}
