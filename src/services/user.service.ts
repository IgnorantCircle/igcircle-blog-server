import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, In } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { User } from '@/entities/user.entity';
import { CreateUserDto, UpdateUserDto } from '@/dto/user.dto';
import { PaginationSortDto } from '@/common/dto/pagination.dto';
import { NotFoundException } from '@/common/exceptions/business.exception';
import * as bcrypt from 'bcrypt';
import { BaseService } from '@/common/base/base.service';
import { CacheStrategyService } from '@/common/cache/cache-strategy.service';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';
import {
  QueryOptimization,
  QueryBuilderOptimizer,
} from '@/common/decorators/query-optimization.decorator';
import { ErrorCode } from '@/common/constants/error-codes';
import { BusinessException } from '@/common/exceptions/business.exception';
@Injectable()
export class UserService extends BaseService<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    protected readonly cacheStrategy: CacheStrategyService,
    protected readonly logger: StructuredLoggerService,
    protected readonly configService: ConfigService,
  ) {
    super(userRepository, cacheStrategy, 'user', configService);
    this.logger.setContext({ module: 'UserService' });
  }

  @QueryOptimization({
    enableQueryLog: true,
    slowQueryThreshold: 500,
  })
  async create(createUserDto: CreateUserDto): Promise<User> {
    const startTime = Date.now();

    try {
      // 检查用户名和邮箱是否已存在
      const existingUser = await this.userRepository.findOne({
        where: [
          { username: createUserDto.username },
          { email: createUserDto.email },
        ],
      });

      if (existingUser) {
        this.logger.warn('用户创建失败：用户名或邮箱已存在', {
          action: 'create',
          resource: 'user',
          metadata: {
            username: createUserDto.username,
            email: createUserDto.email,
          },
        });
        throw new BusinessException(ErrorCode.USER_ALREADY_EXISTS);
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

      const now = Date.now();
      const user = this.userRepository.create({
        ...createUserDto,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      });

      const savedUser = await this.userRepository.save(user);

      // 使用新的缓存策略
      await this.cacheStrategy.set(savedUser.id, savedUser, { type: 'user' });

      const duration = Date.now() - startTime;
      this.logger.business('用户创建成功', {
        businessEvent: 'user_created',
        entityType: 'user',
        entityId: savedUser.id,
        newValue: { username: savedUser.username, email: savedUser.email },
        metadata: { duration },
      });

      return savedUser;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('用户创建失败', error.stack, {
        action: 'create',
        resource: 'user',
        metadata: { duration, error: error.message },
      });
      throw error;
    }
  }

  @QueryOptimization({
    cache: { enabled: true, ttl: 300 },
    enableQueryLog: true,
  })
  async findById(id: string): Promise<User> {
    const startTime = Date.now();

    try {
      // 使用新的多层缓存策略
      let user = await this.cacheStrategy.get<User>(id, { type: 'user' });

      if (user) {
        this.logger.cache('用户缓存命中', {
          operation: 'get',
          key: id,
          hit: true,
          metadata: { source: 'cache' },
        });
        return user;
      }

      // 缓存未命中，从数据库查找
      user = await this.userRepository.findOne({
        where: { id },
      });

      if (!user) {
        this.logger.warn('用户未找到', {
          action: 'findById',
          resource: 'user',
          metadata: { id },
        });
        throw new BusinessException(ErrorCode.USER_NOT_FOUND);
      }

      // 缓存用户信息
      await this.cacheStrategy.set(id, user, { type: 'user' });

      const duration = Date.now() - startTime;
      this.logger.cache('用户缓存未命中，已更新缓存', {
        operation: 'set',
        key: id,
        hit: false,
        metadata: { source: 'database', duration },
      });

      return user;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('查找用户失败', error.stack, {
        action: 'findById',
        resource: 'user',
        metadata: { id, duration, error: error.message },
      });
      throw error;
    }
  }

  async findByUsername(username: string): Promise<User> {
    const cacheKey = `user:username:${username}`;
    const cachedUser = await this.cacheManager.get<User>(cacheKey);

    if (cachedUser) {
      return cachedUser;
    }

    const user = await this.userRepository.findOne({
      where: { username },
    });

    if (!user) {
      throw new NotFoundException(ErrorCode.COMMON_NOT_FOUND, '用户不存在');
    }

    await this.cacheUser(user);

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { email },
    });
  }

  async updateStatus(
    id: string,
    status: 'active' | 'inactive' | 'banned',
  ): Promise<User> {
    const user = await this.findById(id);
    user.status = status;
    const updatedUser = await this.userRepository.save(user);

    // 更新缓存
    await this.cacheUser(updatedUser);

    return updatedUser;
  }

  async updateRole(id: string, role: 'user' | 'admin'): Promise<User> {
    const user = await this.findById(id);
    user.role = role;
    const updatedUser = await this.userRepository.save(user);

    // 更新缓存
    await this.cacheUser(updatedUser);

    return updatedUser;
  }

  async getStatistics(): Promise<any> {
    const [total, activeUsers, adminUsers] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({
        where: { status: 'active' },
      }),
      this.userRepository.count({
        where: { role: 'admin' },
      }),
    ]);

    return {
      total,
      activeUsers,
      adminUsers,
      inactiveUsers: total - activeUsers,
    };
  }

  async batchRemove(ids: string[]): Promise<void> {
    const users = await this.userRepository.find({
      where: { id: In(ids) },
    });

    // 软删除
    await this.userRepository.softDelete({ id: In(ids) });

    // 清除缓存
    await Promise.all(users.map((user) => this.clearUserCache(user)));
  }

  // 获取用户个人统计信息
  async getUserStatistics(userId: string): Promise<any> {
    const cacheKey = `user:stats:${userId}`;
    const cachedStats = await this.cacheManager.get(cacheKey);

    if (cachedStats) {
      return cachedStats;
    }

    // 这里需要根据实际的文章实体关系来查询
    // 假设文章表中有 authorId 字段
    const stats = {
      totalArticles: 0, // 总文章数
      publishedArticles: 0, // 已发布文章数
      draftArticles: 0, // 草稿文章数
      totalViews: 0, // 总浏览量
      totalLikes: 0, // 总点赞数
      totalShares: 0, // 总分享数
    };

    // 缓存统计信息（5分钟）
    await this.cacheManager.set(cacheKey, stats, 300);

    return stats;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    Object.assign(user, updateUserDto, {
      updatedAt: Date.now(),
    });
    const updatedUser = await this.userRepository.save(user);

    // 更新缓存
    await this.cacheUser(updatedUser);

    return updatedUser;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);

    // 逻辑删除
    const now = Date.now();
    await this.userRepository.update(
      { id },
      { deletedAt: now, updatedAt: now },
    );

    // 清除缓存
    await this.clearUserCache(user);
  }

  @QueryOptimization({
    pagination: { defaultLimit: 10, maxLimit: 100 },
    select: [
      'id',
      'username',
      'email',
      'nickname',
      'avatar',
      'bio',
      'status',
      'role',
      'createdAt',
      'updatedAt',
    ],
    enableQueryLog: true,
    slowQueryThreshold: 1000,
  })
  async findAll(
    query: PaginationSortDto,
  ): Promise<{ items: User[]; total: number }> {
    const startTime = Date.now();

    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
      } = query;

      // 使用查询构建器优化
      let queryBuilder = this.userRepository.createQueryBuilder('user');

      // 应用字段选择（排除密码）
      queryBuilder = queryBuilder.select([
        'user.id',
        'user.username',
        'user.email',
        'user.nickname',
        'user.avatar',
        'user.bio',
        'user.status',
        'user.role',
        'user.createdAt',
        'user.updatedAt',
      ]);

      // 排除软删除的用户
      queryBuilder = QueryBuilderOptimizer.excludeSoftDeleted(
        queryBuilder,
        'deletedAt',
      );

      // 应用排序
      queryBuilder = QueryBuilderOptimizer.addSorting(
        queryBuilder,
        sortBy,
        sortOrder,
        ['id', 'username', 'email', 'createdAt', 'updatedAt', 'status', 'role'],
      );

      // 应用分页
      queryBuilder = QueryBuilderOptimizer.applyPagination(
        queryBuilder,
        page,
        limit,
        100,
      );

      // 执行查询
      const [users, total] = await queryBuilder.getManyAndCount();

      const duration = Date.now() - startTime;
      this.logger.performance('用户列表查询完成', {
        operation: 'findAll',
        duration,
        metadata: {
          page,
          limit,
          total,
          resultCount: users.length,
          sortBy,
          sortOrder,
        },
      });

      return { items: users, total };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('用户列表查询失败', error.stack, {
        action: 'findAll',
        resource: 'user',
        metadata: { duration, error: error.message, query },
      });
      throw error;
    }
  }

  private async cacheUser(user: User): Promise<void> {
    const ttl = 60 * 60; // 1小时

    await Promise.all([
      this.cacheManager.set(`user:${user.id}`, user, ttl),
      this.cacheManager.set(`user:username:${user.username}`, user, ttl),
    ]);
  }

  private async clearUserCache(user: User): Promise<void> {
    await Promise.all([
      this.cacheManager.del(`user:${user.id}`),
      this.cacheManager.del(`user:username:${user.username}`),
    ]);
  }

  /**
   * 将JWT token添加到黑名单
   * @param token JWT token
   * @param expiresIn token过期时间（秒）
   */
  async blacklistToken(token: string, expiresIn: number): Promise<void> {
    const key = `blacklist:token:${token}`;
    // 设置缓存过期时间为token的剩余有效期
    await this.cacheManager.set(key, true, expiresIn * 1000);
  }

  /**
   * 检查JWT token是否在黑名单中
   * @param token JWT token
   * @returns 是否在黑名单中
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const key = `blacklist:token:${token}`;
    const result = await this.cacheManager.get(key);
    return !!result;
  }

  /**
   * 清除用户的所有token（强制退出所有设备）
   * @param userId 用户ID
   */
  async clearAllUserTokens(userId: string): Promise<void> {
    // 这里可以实现更复杂的逻辑，比如记录用户的token版本号
    // 当前简单实现：在缓存中标记用户需要重新登录
    const key = `user:force_logout:${userId}`;
    await this.cacheManager.set(key, Date.now(), 24 * 60 * 60 * 1000); // 24小时过期
  }

  /**
   * 检查用户是否被强制退出
   * @param userId 用户ID
   * @param tokenIssuedAt token签发时间
   * @returns 是否被强制退出
   */
  async isUserForcedLogout(
    userId: string,
    tokenIssuedAt: number,
  ): Promise<boolean> {
    const key = `user:force_logout:${userId}`;
    const forceLogoutTime = await this.cacheManager.get<number>(key);
    return forceLogoutTime ? forceLogoutTime > tokenIssuedAt : false;
  }

  /**
   * 检查用户是否在线
   * 用户在线的条件：
   * 1. 用户状态为active
   * 2. 用户没有被强制退出
   * 3. 用户有有效的JWT token（通过检查是否有活跃的session）
   */
  async getUserOnlineStatus(userId: string): Promise<{
    onlineStatus: 'online' | 'offline';
    lastActiveAt: number | null;
  }> {
    try {
      // 检查用户基本状态
      const user = await this.findById(userId);
      if (user.status !== 'active') {
        return {
          onlineStatus: 'offline',
          lastActiveAt: null,
        };
      }

      // 检查是否被强制退出
      const forceLogoutTime = await this.cacheManager.get<number>(
        `user:force_logout:${userId}`,
      );

      // 检查用户最后活跃时间（通过Redis中的session信息）
      const lastActiveAt = await this.cacheManager.get<number>(
        `user:last_active:${userId}`,
      );

      // 如果有强制退出时间，且没有最后活跃时间或最后活跃时间早于强制退出时间
      if (
        forceLogoutTime &&
        (!lastActiveAt || lastActiveAt < forceLogoutTime)
      ) {
        return {
          onlineStatus: 'offline',
          lastActiveAt: lastActiveAt || null,
        };
      }

      // 检查最后活跃时间是否在5分钟内（认为在线）
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000; // 5分钟

      if (lastActiveAt && lastActiveAt > fiveMinutesAgo) {
        return {
          onlineStatus: 'online',
          lastActiveAt,
        };
      }

      return {
        onlineStatus: 'offline',
        lastActiveAt: lastActiveAt || null,
      };
    } catch {
      // 发生错误时默认为离线
      return {
        onlineStatus: 'offline',
        lastActiveAt: null,
      };
    }
  }

  /**
   * 批量获取多个用户的在线状态
   */
  async getBatchUserOnlineStatus(userIds: string[]): Promise<
    Map<
      string,
      {
        onlineStatus: 'online' | 'offline';
        lastActiveAt: number | null;
      }
    >
  > {
    const statusMap = new Map();

    // 并发获取所有用户的在线状态
    const promises = userIds.map(async (userId) => {
      const status = await this.getUserOnlineStatus(userId);
      return { userId, status };
    });

    const results = await Promise.all(promises);

    results.forEach(({ userId, status }) => {
      statusMap.set(userId, status);
    });

    return statusMap;
  }

  /**
   * 更新用户最后活跃时间
   * 这个方法应该在用户每次发起请求时调用
   */
  async updateUserLastActive(userId: string): Promise<void> {
    const now = Date.now();
    await this.cacheManager.set(
      `user:last_active:${userId}`,
      now,
      24 * 60 * 60 * 1000, // 24小时过期
    );
  }
}
