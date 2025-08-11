import {
  Repository,
  FindOptionsWhere,
  FindManyOptions,
  DeepPartial,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Injectable, Inject } from '@nestjs/common';
import { StructuredLoggerService } from '../logger/structured-logger.service';
import { ConfigService } from '@nestjs/config';
import {
  NotFoundException,
  ConflictException,
  ValidationException,
} from '../exceptions/business.exception';
import { ErrorCode } from '../constants/error-codes';
import { PaginationUtil } from '@/common/utils/pagination.util';

// 定义数据库错误接口
interface DatabaseError {
  code?: string;
  errno?: number;
  sqlState?: string;
  name?: string;
  message?: string;
  detail?: string;
  stack?: string;
}

export interface BaseEntity {
  id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export abstract class BaseService<T extends BaseEntity> {
  constructor(
    protected readonly repository: Repository<T>,
    protected readonly entityName: string,
    @Inject(ConfigService) protected readonly configService: ConfigService,
    @Inject(StructuredLoggerService)
    protected readonly logger: StructuredLoggerService,
  ) {}

  /**
   * 根据ID查找实体
   */
  async findById(id: string): Promise<T | null> {
    return await this.repository.findOne({
      where: { id } as FindOptionsWhere<T>,
    });
  }

  /**
   * 查找所有实体
   */
  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    return await this.repository.find(options);
  }

  /**
   * 分页查询
   */
  async findAllPaginated(query: {
    page?: number;
    limit?: number;
    categoryId?: string;
    [key: string]: any;
  }): Promise<{ items: T[]; total: number }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
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
    try {
      const entity = this.repository.create(entityData);
      const savedEntity = await this.repository.save(entity);

      return savedEntity;
    } catch (error: any) {
      this.handleDatabaseError(error, 'create');
      throw error;
    }
  }

  /**
   * 更新实体
   */
  async update(id: string, updateData: QueryDeepPartialEntity<T>): Promise<T> {
    await this.repository.update(id, updateData);

    // 重新获取实体
    const updatedEntity = await this.repository.findOne({
      where: { id } as FindOptionsWhere<T>,
    });

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
    const entity = await this.findById(id);
    if (!entity) {
      throw new NotFoundException(
        ErrorCode.COMMON_NOT_FOUND,
        `${this.entityName} with id ${id} not found`,
      );
    }

    await this.repository.remove(entity);
  }

  /**
   * 软删除实体
   */
  async softRemove(id: string): Promise<void> {
    const entity = await this.findById(id);
    if (!entity) {
      throw new NotFoundException(
        ErrorCode.COMMON_NOT_FOUND,
        `${this.entityName} with id ${id} not found`,
      );
    }

    await this.repository.softRemove(entity);
  }

  /**
   * 处理数据库错误
   */
  protected handleDatabaseError(error: unknown, operation: string): void {
    const dbError = error as DatabaseError;
    const errorMessage = dbError.message || 'Unknown database error';

    this.logger.error(`${this.entityName} ${operation} failed`, dbError.stack, {
      action: `${this.entityName}_${operation}_failed`,
      resource: this.entityName,
      metadata: {
        error: errorMessage,
        code: dbError.code,
        errno: dbError.errno,
        sqlState: dbError.sqlState,
      },
    });

    // 处理常见的数据库错误
    if (dbError.code === 'ER_DUP_ENTRY' || dbError.errno === 1062) {
      throw new ConflictException(
        ErrorCode.COMMON_CONFLICT,
        `${this.entityName} already exists`,
      );
    }

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
   * 批量创建实体
   */
  async createMany(entitiesData: DeepPartial<T>[]): Promise<T[]> {
    try {
      const entities = this.repository.create(entitiesData);
      const savedEntities = await this.repository.save(entities);
      return savedEntities;
    } catch (error: any) {
      this.handleDatabaseError(error, 'createMany');
      throw error;
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
    const entity = await this.findById(id);
    return !!entity;
  }
}
