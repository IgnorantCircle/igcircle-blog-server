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
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserService } from '@/services/user.service';
import { JwtAuthGuard } from '@/guards/auth.guard';
import { RolesGuard } from '@/guards/roles.guard';
import { Roles } from '@/decorators/roles.decorator';
import { Role } from '@/enums/role.enum';
import { AdminUserDto } from '@/dto/base/admin.dto';
import { CreateUserDto, UpdateUserDto, UserQueryDto } from '@/dto/user.dto';
import { plainToClass } from 'class-transformer';

@ApiTags('管理端API - 用户')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth('JWT-auth')
@UseInterceptors(ClassSerializerInterceptor)
export class AdminUserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: '创建用户' })
  @ApiResponse({ status: 201, description: '创建成功', type: AdminUserDto })
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);
    return plainToClass(AdminUserDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Get()
  @ApiOperation({ summary: '获取用户列表' })
  @ApiResponse({ status: 200, description: '获取成功', type: [AdminUserDto] })
  async findAll(@Query() query: UserQueryDto) {
    const queryDto = new UserQueryDto();
    Object.assign(queryDto, query);
    const result = await this.userService.findAll(queryDto);

    const page = Number(queryDto.page) || 1;
    const limit = Number(queryDto.limit) || 10;
    return {
      items: result.users.map((user) =>
        plainToClass(AdminUserDto, user, {
          excludeExtraneousValues: true,
        }),
      ),
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
      hasNext: page < Math.ceil(result.total / limit),
      hasPrev: page > 1,
    };
  }

  @Get('statistics')
  @ApiOperation({ summary: '获取用户统计信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getStatistics() {
    return await this.userService.getStatistics();
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID获取用户详情' })
  @ApiParam({ name: 'id', description: '用户ID' })
  @ApiResponse({ status: 200, description: '获取成功', type: AdminUserDto })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.userService.findById(id);
    return plainToClass(AdminUserDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Put(':id')
  @ApiOperation({ summary: '更新用户信息' })
  @ApiParam({ name: 'id', description: '用户ID' })
  @ApiResponse({ status: 200, description: '更新成功', type: AdminUserDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.userService.update(id, updateUserDto);
    return plainToClass(AdminUserDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Put(':id/status')
  @ApiOperation({ summary: '更新用户状态' })
  @ApiParam({ name: 'id', description: '用户ID' })
  @ApiResponse({ status: 200, description: '更新成功', type: AdminUserDto })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: 'active' | 'inactive' | 'banned',
  ) {
    const user = await this.userService.updateStatus(id, status);
    return plainToClass(AdminUserDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Put(':id/role')
  @ApiOperation({ summary: '更新用户角色' })
  @ApiParam({ name: 'id', description: '用户ID' })
  @ApiResponse({ status: 200, description: '更新成功', type: AdminUserDto })
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('role') role: 'user' | 'admin',
  ) {
    const user = await this.userService.updateRole(id, role);
    return plainToClass(AdminUserDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除用户' })
  @ApiParam({ name: 'id', description: '用户ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.userService.remove(id);
    return { message: '用户删除成功' };
  }

  @Delete('batch')
  @ApiOperation({ summary: '批量删除用户' })
  @ApiResponse({ status: 200, description: '批量删除成功' })
  async batchRemove(@Body('ids') ids: string[]) {
    await this.userService.batchRemove(ids);
    return { message: `成功删除 ${ids.length} 个用户` };
  }
}
