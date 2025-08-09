import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '@/entities/user.entity';
import { CreateUserDto, UserStatus, UserRole } from '@/dto/user.dto';
import { NotFoundException } from '@/common/exceptions/business.exception';
import * as bcrypt from 'bcrypt';
import { BaseService } from '@/common/base/base.service';
import { QueryOptimization } from '@/common/decorators/query-optimization.decorator';
import { ErrorCode } from '@/common/constants/error-codes';
import { BusinessException } from '@/common/exceptions/business.exception';
import { CACHE_TYPES } from '@/common/cache/cache.config';
import { CacheService } from '@/common/cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';

@Injectable()
export class UserService extends BaseService<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(CacheService) cacheService: CacheService,
    @Inject(ConfigService) configService: ConfigService,
    @Inject(StructuredLoggerService) logger: StructuredLoggerService,
  ) {
    super(userRepository, 'user', cacheService, configService, logger);
    this.logger.setContext({ module: 'UserService' });
  }

  /**
   * 创建用户（重写BaseService方法以处理密码加密和唯一性检查）
   */
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

      const userCreateData = {
        ...createUserDto,
        password: hashedPassword,
      };

      // 使用BaseService的create方法
      const savedUser = await super.create(userCreateData);

      const duration = Date.now() - startTime;
      this.logger.business('用户创建成功', 'info', {
        action: 'create',
        resource: 'user',
        metadata: {
          event: 'user_created',
          entityId: savedUser.id,
          username: savedUser.username,
          email: savedUser.email,
          duration,
        },
      });

      return savedUser;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('用户创建失败', errorStack, {
        action: 'create',
        resource: 'user',
        metadata: { duration, error: errorMessage },
      });
      throw error;
    }
  }

  // 移除重复的findById方法，使用BaseService的统一实现

  async findByUsername(username: string): Promise<User> {
    // 使用统一的缓存策略
    const cached = await this.cacheService.get<User>(`username:${username}`, {
      type: CACHE_TYPES.USER,
    });
    if (cached) {
      return cached;
    }

    const user = await this.userRepository.findOne({
      where: { username },
    });

    if (!user) {
      throw new NotFoundException(ErrorCode.COMMON_NOT_FOUND, '用户不存在');
    }

    // 缓存用户信息，同时缓存ID和username两个键
    await Promise.all([
      this.cacheService.set(user.id, user, {
        type: CACHE_TYPES.USER,
      }),
      this.cacheService.set(`username:${username}`, user, {
        type: CACHE_TYPES.USER,
      }),
    ]);

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { email },
    });
  }

  async updateStatus(id: string, status: UserStatus): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(ErrorCode.USER_NOT_FOUND);
    }
    user.status = status;
    const updatedUser = await this.userRepository.save(user);

    // 更新缓存
    await Promise.all([
      this.cacheService.set(updatedUser.id, updatedUser, {
        type: CACHE_TYPES.USER,
      }),
      this.cacheService.set(`email:${updatedUser.email}`, updatedUser, {
        type: CACHE_TYPES.USER,
      }),
    ]);

    return updatedUser;
  }

  async updateRole(id: string, role: UserRole): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(ErrorCode.USER_NOT_FOUND);
    }

    user.role = role;
    const updatedUser = await this.userRepository.save(user);

    // 更新缓存
    await Promise.all([
      this.cacheService.set(updatedUser.id, updatedUser, {
        type: CACHE_TYPES.USER,
      }),
      this.cacheService.set(`email:${updatedUser.email}`, updatedUser, {
        type: CACHE_TYPES.USER,
      }),
    ]);

    return updatedUser;
  }

  async getStatistics(): Promise<{
    total: number;
    activeUsers: number;
    adminUsers: number;
    inactiveUsers: number;
  }> {
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

    // 使用统一的缓存策略清除用户缓存
    await Promise.all(
      users.flatMap((user) => [
        this.cacheService.del(user.id, { type: CACHE_TYPES.USER }),
        this.cacheService.del(`email:${user.email}`, {
          type: CACHE_TYPES.USER,
        }),
        this.cacheService.del(`username:${user.username}`, {
          type: CACHE_TYPES.USER,
        }),
      ]),
    );
  }

  // 获取用户个人统计信息
  async getUserStatistics(userId: string): Promise<{
    totalArticles: number;
    publishedArticles: number;
    draftArticles: number;
    totalViews: number;
    totalLikes: number;
    totalShares: number;
  }> {
    // 使用统一的缓存策略
    const cached = await this.cacheService.get<{
      totalArticles: number;
      publishedArticles: number;
      draftArticles: number;
      totalViews: number;
      totalLikes: number;
      totalShares: number;
    }>(`stats:${userId}`, {
      type: CACHE_TYPES.USER,
    });
    if (cached) {
      return cached;
    }

    // 这里需要根据实际的文章实体关系来查询
    const stats = {
      totalArticles: 0, // 总文章数
      publishedArticles: 0, // 已发布文章数
      draftArticles: 0, // 草稿文章数
      totalViews: 0, // 总浏览量
      totalLikes: 0, // 总点赞数
      totalShares: 0, // 总分享数
    };

    // 缓存统计信息
    await this.cacheService.set(`stats:${userId}`, stats, {
      type: CACHE_TYPES.STATS,
    });

    return stats;
  }

  /**
   * 将JWT token添加到黑名单
   * @param token JWT token
   * @param expiresIn token过期时间（秒）
   */
  async blacklistToken(token: string, expiresIn: number): Promise<void> {
    const key = `blacklist:token:${token}`;
    // 设置缓存过期时间为token的剩余有效期
    await this.cacheService.set(key, true, {
      type: CACHE_TYPES.TEMP,
      ttl: expiresIn,
    });
  }

  /**
   * 检查JWT token是否在黑名单中
   * @param token JWT token
   * @returns 是否在黑名单中
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const key = `blacklist:token:${token}`;
    const result = await this.cacheService.get(key, {
      type: CACHE_TYPES.TEMP,
    });
    return !!result;
  }

  /**
   * 清除用户的所有token（强制退出所有设备）
   * @param userId 用户ID
   */
  async clearAllUserTokens(userId: string): Promise<void> {
    //在缓存中标记用户需要重新登录
    const key = `user:force_logout:${userId}`;
    await this.cacheService.set(key, Date.now(), {
      type: CACHE_TYPES.TEMP,
      ttl: 24 * 60 * 60, // 24小时过期
    });
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
    const forceLogoutTime = await this.cacheService.get<number>(key, {
      type: CACHE_TYPES.TEMP,
    });
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
      if (!user || user.status !== 'active') {
        return {
          onlineStatus: 'offline',
          lastActiveAt: null,
        };
      }

      // 检查是否被强制退出
      const forceLogoutTime = await this.cacheService.get<number>(
        `user:force_logout:${userId}`,
        { type: CACHE_TYPES.TEMP },
      );

      // 检查用户最后活跃时间（通过Redis中的session信息）
      const lastActiveAt = await this.cacheService.get<number>(
        `user:last_active:${userId}`,
        { type: CACHE_TYPES.TEMP },
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
    await this.cacheService.set(`user:last_active:${userId}`, now, {
      type: CACHE_TYPES.TEMP,
      ttl: 24 * 60 * 60, // 24小时过期
    });
  }
}
