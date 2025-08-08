import { SetMetadata, applyDecorators } from '@nestjs/common';
import { Repository, SelectQueryBuilder, ObjectLiteral } from 'typeorm';

// 查询优化选项
export interface QueryOptimizationOptions {
  // 缓存配置
  cache?: {
    enabled: boolean;
    ttl?: number; // 缓存时间（秒）
    key?: string; // 缓存键模板
  };

  // 分页配置
  pagination?: {
    enabled?: boolean;
    defaultLimit: number;
    maxLimit: number;
  };

  // 预加载关系
  relations?: string[];

  // 选择字段
  select?: string[];

  // 索引提示
  indexHints?: string[];

  // 查询超时（毫秒）
  timeout?: number;

  // 是否启用查询日志
  enableQueryLog?: boolean;

  // 慢查询阈值（毫秒）
  slowQueryThreshold?: number;
}

// 查询优化元数据键
export const QUERY_OPTIMIZATION_KEY = 'query_optimization';

/**
 * 查询优化装饰器
 */
export function QueryOptimization(options: QueryOptimizationOptions) {
  return applyDecorators(SetMetadata(QUERY_OPTIMIZATION_KEY, options));
}

/**
 * 缓存查询装饰器
 */
export function CacheQuery(ttl: number = 300, key?: string) {
  return QueryOptimization({
    cache: {
      enabled: true,
      ttl,
      key,
    },
  });
}

/**
 * 分页查询装饰器
 */
export function PaginatedQuery(
  defaultLimit: number = 10,
  maxLimit: number = 100,
) {
  return QueryOptimization({
    pagination: {
      enabled: true,
      defaultLimit,
      maxLimit,
    },
  });
}

/**
 * 预加载关系装饰器
 */
export function WithRelations(...relations: string[]) {
  return QueryOptimization({
    relations,
  });
}

/**
 * 选择字段装饰器
 */
export function SelectFields(...fields: string[]) {
  return QueryOptimization({
    select: fields,
  });
}

/**
 * 慢查询监控装饰器
 */
export function SlowQueryMonitor(threshold: number = 1000) {
  return QueryOptimization({
    enableQueryLog: true,
    slowQueryThreshold: threshold,
  });
}

/**
 * 查询构建器优化工具类
 */
export class QueryBuilderOptimizer {
  /**
   * 优化查询构建器
   */
  static optimize<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    options: QueryOptimizationOptions,
  ): SelectQueryBuilder<T> {
    // 应用字段选择
    if (options.select && options.select.length > 0) {
      queryBuilder.select(
        options.select.map((field) =>
          field.includes('.') ? field : `${queryBuilder.alias}.${field}`,
        ),
      );
    }

    // 应用关系预加载
    if (options.relations && options.relations.length > 0) {
      options.relations.forEach((relation) => {
        if (relation.includes('.')) {
          // 嵌套关系
          const alias = relation.split('.').pop();
          if (alias) {
            queryBuilder.leftJoinAndSelect(relation, alias);
          }
        } else {
          // 直接关系
          queryBuilder.leftJoinAndSelect(
            `${queryBuilder.alias}.${relation}`,
            relation,
          );
        }
      });
    }

    // 应用缓存
    if (options.cache?.enabled) {
      queryBuilder.cache(options.cache.ttl ? options.cache.ttl * 1000 : 300000);
    }

    // 应用查询超时
    if (options.timeout) {
      queryBuilder.setQueryRunner(queryBuilder.connection.createQueryRunner());
    }

    return queryBuilder;
  }

  /**
   * 应用查询优化选项
   */
  static applyOptimizations<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    options: QueryOptimizationOptions,
  ): SelectQueryBuilder<T> {
    return this.optimize(queryBuilder, options);
  }

  /**
   * 应用分页
   */
  static applyPagination<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    page: number = 1,
    limit: number = 10,
    maxLimit: number = 100,
  ): SelectQueryBuilder<T> {
    const safeLimit = Math.min(Math.max(limit, 1), maxLimit);
    const safePage = Math.max(page, 1);
    const offset = (safePage - 1) * safeLimit;

    return queryBuilder.skip(offset).take(safeLimit);
  }

  /**
   * 添加搜索条件
   */
  static addSearchConditions<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    searchFields: string[],
    searchTerm: string,
  ): SelectQueryBuilder<T> {
    if (!searchTerm || searchFields.length === 0) {
      return queryBuilder;
    }

    const conditions = searchFields.map((field, index) => {
      const paramName = `search_${index}`;
      queryBuilder.setParameter(paramName, `%${searchTerm}%`);
      return field.includes('.')
        ? `${field} LIKE :${paramName}`
        : `${queryBuilder.alias}.${field} LIKE :${paramName}`;
    });

    return queryBuilder.andWhere(`(${conditions.join(' OR ')})`);
  }

  /**
   * 添加排序
   */
  static addSorting<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    sortBy: string = 'id',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
    allowedSortFields: string[] = ['id', 'createdAt', 'updatedAt'],
  ): SelectQueryBuilder<T> {
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'id';
    const field = safeSortBy.includes('.')
      ? safeSortBy
      : `${queryBuilder.alias}.${safeSortBy}`;

    return queryBuilder.orderBy(field, sortOrder);
  }

  /**
   * 添加日期范围过滤
   */
  static addDateRangeFilter<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    dateField: string,
    startDate?: Date,
    endDate?: Date,
  ): SelectQueryBuilder<T> {
    const field = dateField.includes('.')
      ? dateField
      : `${queryBuilder.alias}.${dateField}`;

    if (startDate) {
      queryBuilder.andWhere(`${field} >= :startDate`, { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere(`${field} <= :endDate`, { endDate });
    }

    return queryBuilder;
  }

  /**
   * 添加状态过滤
   */
  static addStatusFilter<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    statusField: string = 'status',
    status?: string | string[],
  ): SelectQueryBuilder<T> {
    if (!status) {
      return queryBuilder;
    }

    const field = statusField.includes('.')
      ? statusField
      : `${queryBuilder.alias}.${statusField}`;

    if (Array.isArray(status)) {
      return queryBuilder.andWhere(`${field} IN (:...statuses)`, {
        statuses: status,
      });
    } else {
      return queryBuilder.andWhere(`${field} = :status`, { status });
    }
  }

  /**
   * 添加软删除过滤
   */
  static excludeSoftDeleted<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    deletedAtField: string = 'deletedAt',
  ): SelectQueryBuilder<T> {
    const field = deletedAtField.includes('.')
      ? deletedAtField
      : `${queryBuilder.alias}.${deletedAtField}`;

    return queryBuilder.andWhere(`${field} IS NULL`);
  }

  /**
   * 构建计数查询
   */
  static buildCountQuery<T extends ObjectLiteral>(
    repository: Repository<T>,
    alias: string,
  ): SelectQueryBuilder<T> {
    return repository
      .createQueryBuilder(alias)
      .select(`COUNT(${alias}.id)`, 'count');
  }

  /**
   * 构建存在性查询
   */
  static buildExistsQuery<T extends ObjectLiteral>(
    repository: Repository<T>,
    alias: string,
    conditions: Record<string, any>,
  ): SelectQueryBuilder<T> {
    let queryBuilder = repository
      .createQueryBuilder(alias)
      .select('1')
      .limit(1);

    Object.entries(conditions).forEach(([key, value]) => {
      const field = key.includes('.') ? key : `${alias}.${key}`;
      queryBuilder = queryBuilder.andWhere(`${field} = :${key}`, {
        [key]: value,
      });
    });

    return queryBuilder;
  }

  /**
   * 构建批量查询
   */
  static buildBatchQuery<T extends ObjectLiteral>(
    repository: Repository<T>,
    alias: string,
    ids: (string | number)[],
    batchSize: number = 1000,
  ): SelectQueryBuilder<T>[] {
    const queries: SelectQueryBuilder<T>[] = [];

    for (let i = 0; i < ids.length; i += batchSize) {
      const batchIds = ids.slice(i, i + batchSize);
      const queryBuilder = repository
        .createQueryBuilder(alias)
        .whereInIds(batchIds);

      queries.push(queryBuilder);
    }

    return queries;
  }

  /**
   * 优化JOIN查询
   */
  static optimizeJoins<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    joinOptimizations: {
      relation: string;
      type: 'inner' | 'left' | 'right';
      condition?: string;
      select?: boolean;
    }[],
  ): SelectQueryBuilder<T> {
    joinOptimizations.forEach(({ relation, type, condition, select }) => {
      const joinMethod = select ? `${type}JoinAndSelect` : `${type}Join`;

      if (condition) {
        (queryBuilder as any)[joinMethod](
          `${queryBuilder.alias}.${relation}`,
          relation,
          condition,
        );
      } else {
        (queryBuilder as any)[joinMethod](
          `${queryBuilder.alias}.${relation}`,
          relation,
        );
      }
    });

    return queryBuilder;
  }
}
