import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserService } from '@/services/user.service';

import { RolesGuard } from '@/guards/roles.guard';
import { Roles } from '@/decorators/roles.decorator';
import { Role } from '@/enums/role.enum';
import { UnifiedUserDto } from '@/dto/base/unified-response.dto';
import {
  CreateUserDto,
  UpdateUserDto,
  UserQueryDto,
  UserStatus,
  UserRole,
} from '@/dto/user.dto';
import {
  FieldVisibilityInterceptor,
  UseAdminVisibility,
} from '@/common/interceptors/field-visibility.interceptor';

interface OnlineStatusResponse {
  userId: string;
  onlineStatus: string;
  lastActiveAt: number | null;
}

@ApiTags('管理端API - 用户')
@Controller('admin/users')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth('JWT-auth')
@UseInterceptors(FieldVisibilityInterceptor)
export class AdminUserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @UseAdminVisibility()
  @ApiOperation({ summary: '创建用户' })
  @ApiResponse({ status: 201, description: '创建成功', type: UnifiedUserDto })
  async create(@Body() createUserDto: CreateUserDto): Promise<any> {
    const user = await this.userService.create(createUserDto);
    return user;
  }

  @Get()
  @UseAdminVisibility()
  @ApiOperation({ summary: '获取用户列表' })
  @ApiResponse({ status: 200, description: '获取成功', type: [UnifiedUserDto] })
  async findAll(@Query() query: UserQueryDto): Promise<any> {
    const queryDto = new UserQueryDto();
    Object.assign(queryDto, query);
    const result = await this.userService.findAllPaginated(queryDto);

    // 获取所有用户的在线状态
    const userIds = result.items.map((user) => user.id);
    const onlineStatusMap =
      await this.userService.getBatchUserOnlineStatus(userIds);

    const items = result.items.map((user) => {
      const onlineStatus = onlineStatusMap.get(user.id) || {
        onlineStatus: 'offline',
        lastActiveAt: null,
      };

      return {
        ...user,
        onlineStatus: onlineStatus.onlineStatus,
        lastActiveAt: onlineStatus.lastActiveAt,
      };
    });

    return {
      items: items,
      total: result.total,
      page: queryDto.page || 1,
      limit: queryDto.limit || 10,
    };
  }

  @Get('stats')
  @ApiOperation({ summary: '获取用户统计信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getStatistics(): Promise<{
    total: number;
    activeUsers: number;
    adminUsers: number;
    inactiveUsers: number;
  }> {
    const stats = await this.userService.getStatistics();
    return stats;
  }

  @Get(':id')
  @UseAdminVisibility()
  @ApiOperation({ summary: '根据ID获取用户详情' })
  @ApiParam({ name: 'id', description: '用户ID' })
  @ApiResponse({ status: 200, description: '获取成功', type: UnifiedUserDto })
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<any> {
    const user = await this.userService.findById(id);

    // 获取用户在线状态
    const onlineStatus = await this.userService.getUserOnlineStatus(id);

    const userWithStatus = {
      ...user,
      onlineStatus: onlineStatus.onlineStatus,
      lastActiveAt: onlineStatus.lastActiveAt,
    };

    return userWithStatus;
  }

  @Put(':id')
  @UseAdminVisibility()
  @ApiOperation({ summary: '更新用户信息' })
  @ApiParam({ name: 'id', description: '用户ID' })
  @ApiResponse({ status: 200, description: '更新成功', type: UnifiedUserDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<any> {
    const user = await this.userService.update(id, updateUserDto);
    return user;
  }

  @Put(':id/status')
  @UseAdminVisibility()
  @ApiOperation({ summary: '更新用户状态' })
  @ApiParam({ name: 'id', description: '用户ID' })
  @ApiResponse({ status: 200, description: '更新成功', type: UnifiedUserDto })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: UserStatus,
  ): Promise<any> {
    const user = await this.userService.updateStatus(id, status);
    return user;
  }

  @Put(':id/role')
  @UseAdminVisibility()
  @ApiOperation({ summary: '更新用户角色' })
  @ApiParam({ name: 'id', description: '用户ID' })
  @ApiResponse({ status: 200, description: '更新成功', type: UnifiedUserDto })
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('role') role: UserRole,
  ): Promise<any> {
    const user = await this.userService.updateRole(id, role);
    return user;
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除用户' })
  @ApiParam({ name: 'id', description: '用户ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.userService.remove(id);
    return { message: '用户删除成功' };
  }

  @Delete('batch')
  @ApiOperation({ summary: '批量删除用户' })
  @ApiResponse({ status: 200, description: '批量删除成功' })
  async batchRemove(@Body('ids') ids: string[]): Promise<{ message: string }> {
    await this.userService.batchRemove(ids);
    return { message: `成功删除 ${ids.length} 个用户` };
  }

  @Get(':id/online-status')
  @ApiOperation({ summary: '获取用户实时在线状态' })
  @ApiParam({ name: 'id', description: '用户ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getUserOnlineStatus(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OnlineStatusResponse> {
    const onlineStatus = await this.userService.getUserOnlineStatus(id);
    const result = {
      userId: id,
      ...onlineStatus,
    };
    return result;
  }

  @Post(':id/logout-all')
  @UseAdminVisibility()
  @ApiOperation({ summary: '强制用户退出所有设备' })
  @ApiParam({ name: 'id', description: '用户ID' })
  @ApiResponse({
    status: 200,
    description: '强制退出成功',
    type: UnifiedUserDto,
  })
  async forceLogoutUser(@Param('id', ParseUUIDPipe) id: string): Promise<any> {
    await this.userService.clearAllUserTokens(id);

    // 返回更新后的用户信息（包含最新的在线状态）
    const user = await this.userService.findById(id);
    const onlineStatus = await this.userService.getUserOnlineStatus(id);

    const userWithStatus = {
      ...user,
      onlineStatus: onlineStatus.onlineStatus,
      lastActiveAt: onlineStatus.lastActiveAt,
    };

    return userWithStatus;
  }
}
