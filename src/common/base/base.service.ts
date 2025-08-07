import { Injectable } from '@nestjs/common';
import {
  Repository,
  FindOptionsWhere,
  FindManyOptions,
  DeepPartial,
  In,
} from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CacheStrategyService } from '@/common/cache/cache-strategy.service';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';
import { NotFoundException } from '@/common/exceptions/business.exception';
import { ErrorCode } from '@/common/constants/error-codes';
import { PaginationSortDto } from '@/common/dto/pagination.dto';

export interface BaseEntity {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface CacheOptions {
  ttl?: number; // 缓存时间（秒）
  prefix?: string; // 缓存前缀
}

@Injectable()
export abstract class BaseService<T extends BaseEntity> {
  protected repository: Repository<T>;
  protected entityName: string;
  protected cacheStrategy: CacheStrategyService;
  protected logger: StructuredLoggerService;

  protected cacheOptions: CacheOptions = {
    ttl: 300, // 默认5分钟
    prefix: 'entity',
  };

  constructor(
    repository: Repository<T>,
    cacheStrategy: CacheStrategyService,
    entityName: string = 'Entity',
    protected readonly configService: ConfigService,
  ) {
    this.repository = repository;
    this.cacheStrategy = cacheStrategy;
    this.entityName = entityName;
    this.logger = new StructuredLoggerService(configService);
    this.logger.setContext({ module: `${entityName}Service` });
    this.logger.log('BaseService initialized', {
      module: entityName,
      metadata: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * 根据ID查找实体
   */
  async findById(id: string, useCache: boolean = true): Promise<T> {
    if (useCache) {
      const cached = await this.cacheStrategy.get<T>(id, {
        type: this.entityName as any,
      });
      if (cached) {
        return cached;
      }
    }

    const entity = await this.repository.findOne({
      where: { id } as FindOptionsWhere<T>,
    });

    if (!entity) {
      throw new NotFoundException(ErrorCode.COMMON_NOT_FOUND, this.entityName);
    }

    if (useCache) {
      await this.cacheStrategy.set(id, entity, {
        type: this.entityName as any,
        ttl: this.cacheOptions.ttl,
      });
    }

    return entity;
  }

  /**
   * 创建实体
   */
  async create(createDto: DeepPartial<T>): Promise<T> {
    const now = Date.now();
    const entity = this.repository.create({
      ...createDto,
      createdAt: now,
      updatedAt: now,
    } as DeepPartial<T>);

    const savedEntity = await this.repository.save(entity);
    await this.cacheStrategy.set(savedEntity.id, savedEntity, {
      type: this.entityName as any,
      ttl: this.cacheOptions.ttl,
    });

    return savedEntity;
  }

  /**
   * 更新实体
   */
  async update(id: string, updateDto: DeepPartial<T>): Promise<T> {
    const entity = await this.findById(id, false);

    const updatedEntity = this.repository.merge(entity, {
      ...updateDto,
      updatedAt: Date.now(),
    } as DeepPartial<T>);

    const savedEntity = await this.repository.save(updatedEntity);

    // 更新缓存
    await this.cacheStrategy.set(savedEntity.id, savedEntity, {
      type: this.entityName as any,
      ttl: this.cacheOptions.ttl,
    });

    return savedEntity;
  }

  /**
   * 软删除实体
   */
  async softRemove(id: string): Promise<void> {
    const entity = await this.findById(id, false);

    await this.repository.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    } as any);

    // 清除缓存
    await this.cacheStrategy.del(entity.id, {
      type: this.entityName as any,
    });
  }

  /**
   * 硬删除实体
   */
  async remove(id: string): Promise<void> {
    const entity = await this.findById(id, false);
    await this.repository.delete(id);
    await this.cacheStrategy.del(entity.id, {
      type: this.entityName as any,
    });
  }

  /**
   * 分页查询
   */
  async findAll(
    query: PaginationSortDto,
    additionalWhere?: FindOptionsWhere<T>,
    relations?: string[],
  ): Promise<{ items: T[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;
    const skip = (page - 1) * limit;

    const findOptions: FindManyOptions<T> = {
      where: {
        deletedAt: null,
        ...additionalWhere,
      } as FindOptionsWhere<T>,
      order: {
        [sortBy]: sortOrder,
      } as any,
      skip,
      take: limit,
      relations,
    };

    const [items, total] = await this.repository.findAndCount(findOptions);

    return { items, total };
  }

  /**
   * 批量删除
   */
  async batchRemove(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    // 先获取所有实体用于清除缓存
    const entities = await this.repository.find({
      where: { id: In(ids) } as FindOptionsWhere<T>,
    });

    await this.repository.update(
      { id: In(ids) } as FindOptionsWhere<T>,
      {
        deletedAt: Date.now(),
        updatedAt: Date.now(),
      } as any,
    );

    // 清除缓存
    for (const entity of entities) {
      await this.cacheStrategy.del(entity.id, {
        type: this.entityName as any,
      });
    }
  }

  /**
   * 统计数量
   */
  async count(where?: FindOptionsWhere<T>): Promise<number> {
    return this.repository.count({
      where: {
        deletedAt: null,
        ...where,
      } as FindOptionsWhere<T>,
    });
  }

  /**
   * 检查实体是否存在
   */
  async exists(where: FindOptionsWhere<T>): Promise<boolean> {
    const count = await this.repository.count({ where });
    return count > 0;
  }

  /**
   * 批量缓存
   */
  protected async batchCache(entities: T[]): Promise<void> {
    const promises = entities.map((entity) =>
      this.cacheStrategy.set(entity.id, entity, {
        type: this.entityName as any,
        ttl: this.cacheOptions.ttl,
      }),
    );
    await Promise.all(promises);
  }
}
