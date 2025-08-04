import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { User } from '@/entities/user.entity';
import { CreateUserDto, UpdateUserDto } from '@/dto/user.dto';
import { PaginationSortDto } from '@/common/dto/pagination.dto';
import { ConflictException as BusinessConflictException } from '@/common/exceptions/business.exception';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // 检查用户名和邮箱是否已存在
    const existingUser = await this.userRepository.findOne({
      where: [
        { username: createUserDto.username },
        { email: createUserDto.email },
      ],
    });

    if (existingUser) {
      throw new BusinessConflictException('用户名或邮箱已存在');
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    const savedUser = await this.userRepository.save(user);

    // 缓存用户信息
    await this.cacheUser(savedUser);

    return savedUser;
  }

  async findById(id: number): Promise<User> {
    // 先从缓存中查找
    const cacheKey = `user:${id}`;
    const cachedUser = await this.cacheManager.get<User>(cacheKey);

    if (cachedUser) {
      return cachedUser;
    }

    // 缓存中没有，从数据库查找
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 缓存用户信息
    await this.cacheUser(user);

    return user;
  }

  async findByUsername(username: string): Promise<User> {
    const cacheKey = `user:username:${username}`;
    const cachedUser = await this.cacheManager.get<User>(cacheKey);

    if (cachedUser) {
      return cachedUser;
    }

    const user = await this.userRepository.findOne({ where: { username } });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    await this.cacheUser(user);

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  async updateStatus(
    id: number,
    status: 'active' | 'inactive' | 'banned',
  ): Promise<User> {
    const user = await this.findById(id);
    user.status = status;
    const updatedUser = await this.userRepository.save(user);

    // 更新缓存
    await this.cacheUser(updatedUser);

    return updatedUser;
  }

  async updateRole(id: number, role: 'user' | 'admin'): Promise<User> {
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
      this.userRepository.count({ where: { status: 'active' } }),
      this.userRepository.count({ where: { role: 'admin' } }),
    ]);

    return {
      total,
      activeUsers,
      adminUsers,
      inactiveUsers: total - activeUsers,
    };
  }

  async batchRemove(ids: number[]): Promise<void> {
    const users = await this.userRepository.findByIds(ids);

    // 清除缓存
    await Promise.all(users.map((user) => this.clearUserCache(user)));

    await this.userRepository.delete(ids);
  }
  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);

    // 更新缓存
    await this.cacheUser(updatedUser);

    return updatedUser;
  }

  async remove(id: number): Promise<void> {
    const user = await this.findById(id);

    await this.userRepository.remove(user);

    // 清除缓存
    await this.clearUserCache(user);
  }

  async findAll(
    query: PaginationSortDto,
  ): Promise<{ users: User[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const [users, total] = await this.userRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { [sortBy]: sortOrder },
      select: {
        id: true,
        username: true,
        email: true,
        nickname: true,
        avatar: true,
        bio: true,
        status: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        // 排除密码字段
      },
    });

    return { users, total };
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
}
