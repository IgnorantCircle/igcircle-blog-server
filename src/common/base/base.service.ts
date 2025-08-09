import {
  Repository,
  FindOptionsWhere,
  FindManyOptions,
  DeepPartial,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Injectable, Inject } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { StructuredLoggerService } from '../logger/structured-logger.service';
import { ConfigService } from '@nestjs/config';
import {
  NotFoundException,
  ConflictException,
  ValidationException,
} from '../exceptions/business.exception';
import { ErrorCode } from '../constants/error-codes';
import { PaginationUtil } from '@/common/utils/pagination.util';

export interface BaseEntity {
  id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export abstract class BaseService<T extends BaseEntity> {
  protected readonly defaultCacheTtl: number;

  constructor(
    protected readonly repository: Repository<T>,
    protected readonly entityName: string,
    @Inject(CacheService) protected readonly cacheService: CacheService,
    @Inject(ConfigService) protected readonly configService: ConfigService,
    @Inject(StructuredLoggerService)
    protected readonly logger: StructuredLoggerService,
  ) {
    this.defaultCacheTtl =
      this.configService.get<number>('CACHE_TTL', 300) || 300;
  }

  /**
   * 根据ID查找实体（带缓存）
   */
  async findById(id: string, useCache: boolean = true): Promise<T | null> {
    if (useCache) {
      const cached = await this.cacheService.get<T>(`${id}`, {
        type: this.entityName,
      });
      if (cached) {
        return cached;
      }
    }

    const entity = await this.repository.findOne({
      where: { id } as FindOptionsWhere<T>,
    });

    if (entity && useCache) {
      await this.cacheService.set(`${id}`, entity, {
        type: this.entityName,
        ttl: this.defaultCacheTtl,
      });
    }

    return entity;
  }

  /**
   * 查找所有实体
   */
  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    return await this.repository.find(options);
  }

  /**
   * 分页查找实体
   */
  async findAllPaginated(query: {
    page?: number;
    limit?: number;
    [key: string]: any;
  }): Promise<{ items: T[]; total: number }> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = PaginationUtil.calculateSkip(page, limit);

    const [items, total] = await this.repository.findAndCount({
      skip,
      take: limit,
      ...query,
    });

    return { items, total };
  }

  /**
   * 创建实体
   */
  async create(entityData: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(entityData);
    const savedEntity = await this.repository.save(entity);

    // 确保savedEntity是单个实体而不是数组
    let result: T;
    if (Array.isArray(savedEntity)) {
      result = savedEntity[0] as T;
    } else {
      result = savedEntity;
    }

    // 缓存新创建的实体
    await this.cacheService.set(`${result.id}`, result, {
      type: this.entityName,
      ttl: this.defaultCacheTtl,
    });

    return result;
  }

  /**
   * 更新实体
   */
  async update(id: string, updateData: QueryDeepPartialEntity<T>): Promise<T> {
    await this.repository.update(id, updateData);

    // 清除缓存
    await this.cacheService.del(`${id}`, { type: this.entityName });

    // 重新获取实体
    const updatedEntity = await this.repository.findOne({
      where: { id } as FindOptionsWhere<T>,
    });

    if (updatedEntity) {
      // 重新缓存
      await this.cacheService.set(`${id}`, updatedEntity, {
        type: this.entityName,
        ttl: this.defaultCacheTtl,
      });
    }

    if (!updatedEntity) {
      throw new NotFoundException(
        ErrorCode.COMMON_NOT_FOUND,
        `${this.entityName} with id ${id} not found`,
      );
    }

    return updatedEntity;
  }

  /**
   * 删除实体
   */
  async remove(id: string): Promise<void> {
    await this.repository.delete(id);

    // 清除缓存
    await this.cacheService.del(`${id}`, { type: this.entityName });
  }

  /**
   * 批量删除实体
   */
  async batchRemove(ids: string[]): Promise<void> {
    await this.repository.delete(ids);

    // 批量清除缓存
    for (const id of ids) {
      await this.cacheService.del(`${id}`, { type: this.entityName });
    }
  }

  /**
   * 清除实体类型的所有缓存
   */
  async clearCache(): Promise<void> {
    await this.cacheService.clearByType(this.entityName);
  }

  /**
   * 统一的缓存清理方法，支持自定义缓存键和模式
   */
  protected async clearCacheWithPatterns(
    specificKeys: string[] = [],
    patterns: string[] = [],
  ): Promise<void> {
    try {
      // 清除实体类型的所有缓存
      await this.cacheService.clearByType(this.entityName);

      // 清除特定的缓存键
      const deletePromises = specificKeys.map((key) =>
        this.cacheService.del(key).catch((err) =>
          this.logger.warn(`Failed to delete cache ${key}`, {
            metadata: {
              key,
              operation: 'clearCacheWithPatterns',
              error: err instanceof Error ? err.message : '未知错误',
            },
          }),
        ),
      );

      // 清除按模式匹配的键
      for (const pattern of patterns) {
        deletePromises.push(
          this.cacheService.clearCacheByPattern(pattern).catch((err) =>
            this.logger.warn(`Failed to clear cache pattern ${pattern}`, {
              metadata: {
                pattern,
                operation: 'clearCacheWithPatterns',
                error: err instanceof Error ? err.message : '未知错误',
              },
            }),
          ),
        );
      }

      await Promise.all(deletePromises);
    } catch (error) {
      this.logger.error(
        `Failed to clear ${this.entityName} cache`,
        error instanceof Error ? error.stack : undefined,
        {
          metadata: { operation: 'clearCacheWithPatterns' },
        },
      );
    }
  }

  /**
   * 统一的错误处理方法
   */
  protected handleError(
    error: unknown,
    operation: string,
    context?: unknown,
  ): never {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    const dbError = error as {
      code?: string;
      detail?: string;
      message?: string;
      name?: string;
    };

    this.logger.error(
      `${this.entityName} ${operation} failed: ${errorMessage}`,
      error instanceof Error ? error.stack : undefined,
      {
        metadata: {
          operation,
          entityName: this.entityName,
          context,
          error: errorMessage,
        },
      },
    );

    // 根据错误类型抛出相应的业务异常
    if (dbError.code === '23505' || dbError.code === 'ER_DUP_ENTRY') {
      // 数据库唯一约束冲突
      throw new ConflictException(
        ErrorCode.COMMON_CONFLICT,
        `${this.entityName} already exists`,
      );
    }

    if (dbError.code === '23503' || dbError.code === 'ER_NO_REFERENCED_ROW_2') {
      // 外键约束错误
      throw new ValidationException(`Invalid reference in ${this.entityName}`, [
        dbError.detail || dbError.message || 'Unknown error',
      ]);
    }

    if (error instanceof NotFoundException) {
      throw error;
    }

    if (error instanceof ConflictException) {
      throw error;
    }

    if (error instanceof ValidationException) {
      throw error;
    }

    // 处理其他已知错误类型
    if (dbError.name === 'QueryFailedError') {
      throw new ValidationException(
        `Database operation failed: ${errorMessage}`,
      );
    }

    if (dbError.name === 'EntityNotFoundError') {
      throw new NotFoundException(
        ErrorCode.COMMON_NOT_FOUND,
        `${this.entityName} not found`,
      );
    }

    // 默认抛出通用错误
    throw new ValidationException(
      `${this.entityName} ${operation} failed: ${errorMessage}`,
      [dbError.detail || dbError.message || 'Unknown error'],
    );
  }

  /**
   * 安全的数据库操作包装器
   */
  protected async safeDbOperation<R>(
    operation: () => Promise<R>,
    operationName: string,
    context?: unknown,
  ): Promise<R> {
    try {
      return await operation();
    } catch (error) {
      this.handleError(error, operationName, context);
    }
  }

  /**
   * 统计实体数量
   */
  async count(where?: FindOptionsWhere<T>): Promise<number> {
    return await this.repository.count({ where });
  }

  /**
   * 检查实体是否存在
   */
  async exists(id: string): Promise<boolean> {
    const entity = await this.findById(id, true);
    return !!entity;
  }
}
