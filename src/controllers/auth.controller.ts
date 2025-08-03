import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../services/user.service';
import { Public } from '../decorators/public.decorator';
import * as bcrypt from 'bcrypt';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../entities/user.entity';

export class LoginDto {
  @ApiProperty({ description: '用户名或邮箱' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class LoginResponseDto {
  @ApiProperty({ description: '访问令牌' })
  access_token: string;

  @ApiProperty({ description: '用户信息' })
  user: Pick<User, 'id' | 'username' | 'email' | 'nickname' | 'role'>;
}

@ApiTags('认证')
@Controller('auth')
@Public()
export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({ status: 200, description: '登录成功', type: LoginResponseDto })
  @ApiResponse({ status: 401, description: '用户名或密码错误' })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    const { username, password } = loginDto;

    // 查找用户（支持用户名或邮箱登录）
    let user: User | null = null;
    try {
      if (username.includes('@')) {
        user = await this.userService.findByEmail(username);
      } else {
        user = await this.userService.findByUsername(username);
      }

      if (!user) {
        throw new UnauthorizedException('用户名或密码错误');
      }
    } catch {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 检查用户状态
    if (user.status !== 'active') {
      throw new UnauthorizedException('账户已被禁用');
    }

    // 生成JWT令牌
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const access_token = await this.jwtService.signAsync(payload);

    return {
      access_token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
      },
    };
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '管理员登录' })
  @ApiResponse({ status: 200, description: '登录成功', type: LoginResponseDto })
  @ApiResponse({ status: 401, description: '用户名或密码错误或权限不足' })
  async adminLogin(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    const result = await this.login(loginDto);

    // 检查是否为管理员
    if (result.user.role !== 'admin') {
      throw new UnauthorizedException('权限不足，需要管理员权限');
    }

    return result;
  }
}
