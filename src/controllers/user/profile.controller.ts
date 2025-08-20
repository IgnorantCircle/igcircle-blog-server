import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import * as multer from 'multer';

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

@ApiTags('2.3 用户端API - 个人资料')
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

  @Post('avatar')
  @UseUserVisibility()
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 1024 * 1024, // 1MB
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              '只支持 jpeg、jpg、png、gif、webp 格式的图片',
            ),
            false,
          );
        }
      },
    }),
  )
  @ApiOperation({ summary: '上传用户头像' })
  @ApiResponse({
    status: 200,
    description: '头像上传成功',
    type: UnifiedUserDto,
  })
  @ApiResponse({ status: 400, description: '头像文件过大或格式不正确' })
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserType,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException('请选择要上传的头像文件');
    }

    // 将文件转换为base64格式
    const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    // 更新用户头像
    const updatedUser = await this.userService.update(user.id, {
      avatar: base64,
    });
    return updatedUser;
  }
}
