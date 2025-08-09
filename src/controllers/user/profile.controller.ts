import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserService } from '@/services/user.service';

import { RolesGuard } from '@/guards/roles.guard';
import { Roles } from '@/decorators/roles.decorator';
import { Role } from '@/enums/role.enum';
import { CurrentUser } from '@/decorators/user.decorator';
import { UnifiedUserDto } from '@/dto/base/unified-response.dto';
import { UpdateUserDto } from '@/dto/user.dto';

import {
  FieldVisibilityInterceptor,
  UseUserVisibility,
} from '@/common/interceptors/field-visibility.interceptor';

interface CurrentUserType {
  id: string;
  username: string;
  email: string;
  role: string;
}

export interface UserStatistics {
  totalArticles: number;
  publishedArticles: number;
  draftArticles: number;
  totalViews: number;
  totalLikes: number;
  totalShares: number;
}

@ApiTags('用户端API - 个人资料')
@Controller('users/profile')
@UseGuards(RolesGuard)
@Roles(Role.USER, Role.ADMIN)
@ApiBearerAuth('JWT-auth')
@UseInterceptors(FieldVisibilityInterceptor)
export class UserProfileController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @UseUserVisibility()
  @ApiOperation({ summary: '获取个人资料' })
  @ApiResponse({ status: 200, description: '获取成功', type: UnifiedUserDto })
  async getProfile(@CurrentUser() user: CurrentUserType): Promise<any> {
    const userProfile = await this.userService.findById(user.id);
    return userProfile;
  }

  @Put()
  @UseUserVisibility()
  @ApiOperation({ summary: '更新个人资料' })
  @ApiResponse({ status: 200, description: '更新成功', type: UnifiedUserDto })
  async updateProfile(
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: CurrentUserType,
  ): Promise<any> {
    const updatedUser = await this.userService.update(user.id, updateUserDto);
    return updatedUser;
  }

  @Get('stats')
  @ApiOperation({ summary: '获取个人统计信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getStatistics(
    @CurrentUser() user: CurrentUserType,
  ): Promise<UserStatistics> {
    const statistics = await this.userService.getUserStatistics(user.id);
    return statistics;
  }
}
