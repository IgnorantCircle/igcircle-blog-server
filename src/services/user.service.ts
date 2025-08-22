import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '@/entities/user.entity';
import { CreateUserDto, UserStatus, UserRole } from '@/dto/user.dto';
import { NotFoundException } from '@/common/exceptions/business.exception';
import * as bcrypt from 'bcrypt';
import { BaseService } from '@/common/base/base.service';
import { QueryOptimization } from '@/common/decorators/query-optimization.decorator';
import { ErrorCode } from '@/common/constants/error-codes';
import { BusinessException } from '@/common/exceptions/business.exception';
import { ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';
import { BlogCacheService } from '@/common/cache/blog-cache.service';

interface JwtPayload {
  sub: string;
  jti: string;
  [key: string]: unknown;
}

function isJwtPayload(decoded: unknown): decoded is JwtPayload {
  return (
    decoded !== null &&
    typeof decoded === 'object' &&
    decoded !== undefined &&
    'sub' in decoded &&
    'jti' in decoded &&
    typeof (decoded as Record<string, unknown>).sub === 'string' &&
    typeof (decoded as Record<string, unknown>).jti === 'string'
  );
}

@Injectable()
export class UserService extends BaseService<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(ConfigService) configService: ConfigService,
    @Inject(StructuredLoggerService) logger: StructuredLoggerService,
    @Inject(BlogCacheService) private readonly cacheService: BlogCacheService,
    private readonly jwtService: JwtService,
  ) {
    super(userRepository, 'user', configService, logger);
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
    const user = await this.userRepository.findOne({
      where: { username },
    });

    if (!user) {
      throw new NotFoundException(ErrorCode.COMMON_NOT_FOUND, '用户不存在');
    }

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

    // 使用update方法而不是save方法，避免意外覆盖其他字段
    await this.userRepository.update(id, {
      status,
      updatedAt: new Date(),
    });

    // 重新获取更新后的用户
    const updatedUser = await this.userRepository.findOne({ where: { id } });
    if (!updatedUser) {
      throw new NotFoundException(ErrorCode.USER_NOT_FOUND);
    }

    return updatedUser;
  }

  async updateRole(id: string, role: UserRole): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(ErrorCode.USER_NOT_FOUND);
    }

    await this.userRepository.update(id, {
      role,
      updatedAt: new Date(),
    });

    // 重新获取更新后的用户
    const updatedUser = await this.userRepository.findOne({ where: { id } });
    if (!updatedUser) {
      throw new NotFoundException(ErrorCode.USER_NOT_FOUND);
    }

    return updatedUser;
  }

  async getStatistics(): Promise<{
    total: number;
    activeUsers: number;
    adminUsers: number;
    inactiveUsers: number;
    onlineUsers: number;
    bannedUsers: number;
  }> {
    const [total, activeUsers, adminUsers, onlineUsers, bannedUsers] =
      await Promise.all([
        this.userRepository.count(),
        this.userRepository.count({
          where: { status: 'active' },
        }),
        this.userRepository.count({
          where: { role: 'admin' },
        }),
        this.userRepository.count({
          where: {
            lastActiveAt: MoreThanOrEqual(
              new Date(Date.now() - 15 * 60 * 1000),
            ), // 15分钟内活跃的用户视为在线
          },
        }),
        this.userRepository.count({
          where: { status: 'banned' },
        }),
      ]);

    return {
      total,
      activeUsers,
      adminUsers,
      inactiveUsers: total - activeUsers,
      onlineUsers,
      bannedUsers,
    };
  }

  async batchRemove(ids: string[]): Promise<void> {
    // 软删除
    await this.userRepository.softDelete({ id: In(ids) });
  }

  // 获取用户个人统计信息
  async getUserStatistics(userId: string): Promise<{
    totalViews: number;
    totalLikes: number;
    totalShares: number;
  }> {
    // 这里需要根据实际的文章实体关系来查询
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException(ErrorCode.USER_NOT_FOUND);
    }

    const stats = {
      totalViews: 0, // 总浏览量
      totalLikes: 0, // 总点赞数
      totalShares: 0, // 总分享数
    };

    return await Promise.resolve(stats);
  }

  /**
   * 检查token是否在黑名单中
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      // 从token中提取用户ID和tokenId
      const decoded: unknown = this.jwtService.decode(token);
      if (!isJwtPayload(decoded)) {
        this.logger.warn('无效的token格式', {
          action: 'check_token_blacklist',
          resource: 'token',
          metadata: { tokenHash: token.substring(0, 20) + '...' },
        });
        return true;
      }

      const userId: string = decoded.sub;
      const tokenId: string = decoded.jti;

      // 使用BlogCacheService检查token是否存在
      const cachedToken = await this.cacheService.getUserToken(userId, tokenId);

      // 如果缓存中没有该token，说明已被拉黑或过期
      const isBlacklisted = !cachedToken;

      this.logger.debug('Token黑名单检查结果', {
        action: 'check_token_blacklist',
        resource: 'token',
        metadata: {
          userId,
          tokenId,
          isBlacklisted,
        },
      });

      return isBlacklisted;
    } catch (error) {
      this.logger.error('检查token黑名单失败', error);
      return true; // 出错时默认认为token无效
    }
  }

  /**
   * 检查用户是否被强制退出
   */
  async isUserForcedLogout(userId: string, tokenIat: number): Promise<boolean> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'forcedLogoutAt'],
      });

      if (!user) {
        this.logger.warn('强制退出检查：用户不存在', {
          action: 'check_forced_logout',
          resource: 'user',
          metadata: { userId },
        });
        return true; // 用户不存在，视为强制退出
      }

      // 如果用户没有强制退出时间，则未被强制退出
      if (!user.forcedLogoutAt) {
        return false;
      }

      // 比较token签发时间和强制退出时间
      const forcedLogoutTime = user.forcedLogoutAt.getTime();
      const isForcedLogout = tokenIat < forcedLogoutTime;

      this.logger.debug('强制退出检查', {
        action: 'check_forced_logout',
        resource: 'user',
        metadata: {
          userId,
          tokenIat,
          forcedLogoutTime,
          isForcedLogout,
        },
      });

      return isForcedLogout;
    } catch (error) {
      this.logger.error('强制退出检查失败', error, {
        action: 'check_forced_logout',
        resource: 'user',
        metadata: {
          userId,
          tokenIat,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      // 检查失败时默认返回false，不阻止用户访问
      return false;
    }
  }

  async updateUserLastActive(userId: string): Promise<void> {
    try {
      const now = new Date();

      // 更新数据库中的最后活跃时间
      await this.userRepository.update({ id: userId }, { lastActiveAt: now });

      // 使用BlogCacheService设置用户在线状态
      await this.cacheService.setUserOnlineStatus(
        userId,
        'online',
        now.getTime(),
      );

      this.logger.debug('用户最后活跃时间已更新', {
        action: 'update_last_active',
        resource: 'user',
        metadata: {
          userId,
          lastActiveAt: now.getTime(),
        },
      });
    } catch (error) {
      this.logger.error('更新用户最后活跃时间失败', error, {
        action: 'update_last_active',
        resource: 'user',
        metadata: {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      // 更新失败不抛出异常，避免影响主要业务流程
    }
  }

  async getBatchUserOnlineStatus(
    userIds: string[],
  ): Promise<
    Map<string, { onlineStatus: string; lastActiveAt: number | null }>
  > {
    try {
      // 批量获取用户在线状态
      const result = new Map<
        string,
        { onlineStatus: string; lastActiveAt: number | null }
      >();

      // 并行获取所有用户的在线状态
      const statusPromises = userIds.map(async (userId) => {
        const status = await this.cacheService.getUserOnlineStatus(userId);
        return { userId, status };
      });

      const statusResults = await Promise.all(statusPromises);

      // 处理结果
      statusResults.forEach(({ userId, status }) => {
        if (status) {
          result.set(userId, status);
        } else {
          // 如果缓存中没有，从数据库查询
          result.set(userId, {
            onlineStatus: 'offline',
            lastActiveAt: null,
          });
        }
      });

      this.logger.debug('批量获取用户在线状态', {
        action: 'get_batch_online_status',
        resource: 'user',
        metadata: {
          userCount: userIds.length,
        },
      });

      return result;
    } catch (error) {
      this.logger.error('批量获取用户在线状态失败', error, {
        action: 'get_batch_online_status',
        resource: 'user',
        metadata: {
          userIds,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      // 发生错误时返回默认离线状态
      const result = new Map<
        string,
        { onlineStatus: string; lastActiveAt: number | null }
      >();
      userIds.forEach((userId) => {
        result.set(userId, {
          onlineStatus: 'offline',
          lastActiveAt: null,
        });
      });

      return result;
    }
  }

  async getUserOnlineStatus(
    userId: string,
  ): Promise<{ onlineStatus: string; lastActiveAt: number | null }> {
    try {
      // 使用BlogCacheService获取用户在线状态
      const status = await this.cacheService.getUserOnlineStatus(userId);

      if (!status) {
        // 如果缓存中没有，从数据库查询
        const user = await this.userRepository.findOne({
          where: { id: userId },
          select: ['id', 'lastActiveAt'],
        });

        if (!user) {
          return {
            onlineStatus: 'offline',
            lastActiveAt: null,
          };
        }

        const now = Date.now();
        const lastActiveAt = user.lastActiveAt?.getTime() || null;
        const isOnline = lastActiveAt && now - lastActiveAt < 5 * 60 * 1000;

        return {
          onlineStatus: isOnline ? 'online' : 'offline',
          lastActiveAt,
        };
      }

      this.logger.debug('获取用户在线状态', {
        action: 'get_online_status',
        resource: 'user',
        metadata: {
          userId,
          onlineStatus: status.onlineStatus,
          lastActiveAt: status.lastActiveAt,
        },
      });

      return status;
    } catch (error) {
      this.logger.error('获取用户在线状态失败', error, {
        action: 'get_online_status',
        resource: 'user',
        metadata: {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      // 发生错误时返回默认离线状态
      return {
        onlineStatus: 'offline',
        lastActiveAt: null,
      };
    }
  }

  async blacklistToken(token: string, expiresIn: number): Promise<void> {
    try {
      // 从token中提取用户ID和tokenId，然后清除该token
      const decoded: unknown = this.jwtService.decode(token);
      if (isJwtPayload(decoded)) {
        const userId: string = decoded.sub;
        const tokenId: string = decoded.jti;
        await this.cacheService.clearUserToken(userId, tokenId);
      }

      this.logger.business('Token已加入黑名单', 'info', {
        action: 'blacklist_token',
        resource: 'user',
        metadata: {
          event: 'token_blacklisted',
          tokenHash: token.substring(0, 10) + '...',
          expiresIn,
          blacklistedAt: Date.now(),
        },
      });
    } catch (error) {
      this.logger.error('Token黑名单添加失败', error, {
        action: 'blacklist_token',
        resource: 'user',
        metadata: {
          tokenHash: token.substring(0, 10) + '...',
          expiresIn,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw new BusinessException(
        ErrorCode.CACHE_SET_FAILED,
        'Token黑名单添加失败',
      );
    }
  }

  async clearAllUserTokens(userId: string): Promise<void> {
    try {
      const now = new Date();

      // 设置强制退出时间，使所有现有token失效
      await this.userRepository.update({ id: userId }, { forcedLogoutAt: now });

      // 清除用户相关的所有缓存
      await this.cacheService.clearUserCache(userId);

      this.logger.business('用户所有Token已清除', 'info', {
        action: 'clear_all_tokens',
        resource: 'user',
        metadata: {
          event: 'user_forced_logout',
          userId,
          forcedLogoutAt: now.getTime(),
        },
      });
    } catch (error) {
      this.logger.error('清除用户所有Token失败', error, {
        action: 'clear_all_tokens',
        resource: 'user',
        metadata: {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw new BusinessException(ErrorCode.AUTH_LOGOUT_FAILED, '强制退出失败');
    }
  }

  /**
   * 更新用户密码
   */
  async updatePassword(email: string, newPassword: string): Promise<User> {
    const startTime = Date.now();

    try {
      // 查找用户
      const user = await this.findByEmail(email);
      if (!user) {
        this.logger.warn('更新密码失败：用户不存在', {
          action: 'updatePassword',
          metadata: { email },
        });
        throw new BusinessException(ErrorCode.USER_NOT_FOUND, '用户不存在');
      }

      // 加密新密码
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // 更新密码
      await this.userRepository.update(user.id, {
        password: hashedPassword,
        updatedAt: new Date(),
      });

      // 获取更新后的用户信息
      const updatedUser = await this.findById(user.id);
      if (!updatedUser) {
        throw new BusinessException(ErrorCode.USER_NOT_FOUND, '用户更新失败');
      }

      // 清除该用户的所有令牌，强制重新登录
      await this.clearAllUserTokens(user.id);

      const duration = Date.now() - startTime;
      this.logger.business('用户密码更新成功', 'info', {
        action: 'updatePassword',
        resource: 'user',
        metadata: {
          event: 'password_updated',
          entityId: user.id,
          email: user.email,
          duration,
        },
      });

      return updatedUser;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('用户密码更新失败', errorStack, {
        action: 'updatePassword',
        resource: 'user',
        metadata: { duration, error: errorMessage, email },
      });
      throw error;
    }
  }

  /**
   * 验证当前密码并更新为新密码
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<User> {
    const startTime = Date.now();

    try {
      // 查找用户
      const user = await this.findById(userId);
      if (!user) {
        this.logger.warn('修改密码失败：用户不存在', {
          action: 'changePassword',
          metadata: { userId },
        });
        throw new BusinessException(ErrorCode.USER_NOT_FOUND, '用户不存在');
      }

      // 验证当前密码
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password,
      );
      if (!isCurrentPasswordValid) {
        this.logger.warn('修改密码失败：当前密码错误', {
          action: 'changePassword',
          metadata: { userId },
        });
        throw new BusinessException(
          ErrorCode.USER_INVALID_CREDENTIALS,
          '当前密码错误',
        );
      }

      // 检查新密码是否与当前密码相同
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        this.logger.warn('修改密码失败：新密码与当前密码相同', {
          action: 'changePassword',
          metadata: { userId },
        });
        throw new BusinessException(
          ErrorCode.USER_INVALID_CREDENTIALS,
          '新密码不能与当前密码相同',
        );
      }

      // 加密新密码
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // 更新密码
      await this.userRepository.update(userId, {
        password: hashedPassword,
        updatedAt: new Date(),
      });

      // 获取更新后的用户信息
      const updatedUser = await this.findById(userId);
      if (!updatedUser) {
        throw new BusinessException(ErrorCode.USER_NOT_FOUND, '用户更新失败');
      }

      // 清除该用户的所有令牌，强制重新登录
      await this.clearAllUserTokens(userId);

      const duration = Date.now() - startTime;
      this.logger.business('用户密码修改成功', 'info', {
        action: 'changePassword',
        resource: 'user',
        metadata: {
          event: 'password_changed',
          entityId: userId,
          duration,
        },
      });

      return updatedUser;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('用户密码修改失败', errorStack, {
        action: 'changePassword',
        resource: 'user',
        metadata: { duration, error: errorMessage, userId },
      });
      throw error;
    }
  }
}
