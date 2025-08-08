import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserService } from '@/services/user.service';
import { JwtAuthGuard } from '@/guards/auth.guard';
import { RolesGuard } from '@/guards/roles.guard';
import { Roles } from '@/decorators/roles.decorator';
import { Role } from '@/enums/role.enum';
import { CurrentUser } from '@/decorators/user.decorator';
import { UserProfileDto } from '@/dto/base/user.dto';
import { UpdateUserDto } from '@/dto/user.dto';
import { plainToClass } from 'class-transformer';
import { ResponseUtil } from '@/common/utils/response.util';
import { ApiResponse as ApiResponseInterface } from '@/common/interfaces/response.interface';

@ApiTags('用户端API - 个人资料')
@Controller('users/profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER, Role.ADMIN)
@ApiBearerAuth('JWT-auth')
@UseInterceptors(ClassSerializerInterceptor)
export class UserProfileController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: '获取个人资料' })
  @ApiResponse({ status: 200, description: '获取成功', type: UserProfileDto })
  async getProfile(
    @CurrentUser() user: any,
  ): Promise<ApiResponseInterface<UserProfileDto>> {
    const userProfile = await this.userService.findById(user.id);
    const profileDto = plainToClass(UserProfileDto, userProfile);
    return ResponseUtil.success(profileDto, '获取个人资料成功');
  }

  @Put()
  @ApiOperation({ summary: '更新个人资料' })
  @ApiResponse({ status: 200, description: '更新成功', type: UserProfileDto })
  async updateProfile(
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: any,
  ): Promise<ApiResponseInterface<UserProfileDto>> {
    const updatedUser = await this.userService.update(user.id, updateUserDto);
    const profileDto = plainToClass(UserProfileDto, updatedUser);
    return ResponseUtil.success(profileDto, '个人资料更新成功');
  }

  @Get('stats')
  @ApiOperation({ summary: '获取个人统计信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getStatistics(
    @CurrentUser() user: any,
  ): Promise<ApiResponseInterface<any>> {
    const statistics = await this.userService.getUserStatistics(user.id);
    return ResponseUtil.success(statistics, '获取个人统计信息成功');
  }
}
