import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '@/services/user.service';
import { EmailService } from '@/services/email.service';
import { Public } from '@/decorators/public.decorator';
import * as bcrypt from 'bcrypt';
import { User } from '@/entities/user.entity';
import {
  LoginDto,
  LoginResponseDto,
  RegisterDto,
  RegisterResponseDto,
  SendVerificationCodeDto,
  VerificationCodeResponseDto,
} from '@/dto/auth.dto';
import { CreateUserDto } from '@/dto/user.dto';

@ApiTags('认证')
@Controller('/auth')
@Public()
export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
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

    const result: LoginResponseDto = {
      access_token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
      },
    };

    return result;
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

  @Post('send-verification-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '发送注册验证码' })
  @ApiResponse({
    status: 200,
    description: '验证码发送成功',
    type: VerificationCodeResponseDto,
  })
  @ApiResponse({ status: 400, description: '请求参数错误或发送频率过高' })
  async sendVerificationCode(
    @Body() sendCodeDto: SendVerificationCodeDto,
  ): Promise<VerificationCodeResponseDto> {
    // 检查邮箱是否已被注册
    const existingUser = await this.userService.findByEmail(sendCodeDto.email);
    if (existingUser) {
      throw new BadRequestException('该邮箱已被注册');
    }

    await this.emailService.sendVerificationCode(sendCodeDto.email);

    return {
      message: '验证码已发送到您的邮箱，请查收',
    };
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '用户注册' })
  @ApiResponse({
    status: 201,
    description: '注册成功',
    type: RegisterResponseDto,
  })
  @ApiResponse({ status: 400, description: '注册信息无效或验证码错误' })
  @ApiResponse({ status: 409, description: '用户名或邮箱已存在' })
  async register(
    @Body() registerDto: RegisterDto,
  ): Promise<RegisterResponseDto> {
    // 验证验证码
    const isCodeValid = await this.emailService.verifyCode(
      registerDto.email,
      registerDto.verificationCode,
    );

    if (!isCodeValid) {
      throw new BadRequestException('验证码无效或已过期');
    }

    // 创建用户DTO
    const createUserDto: CreateUserDto = {
      username: registerDto.username,
      email: registerDto.email,
      password: registerDto.password,
    };

    // 创建用户
    const user = await this.userService.create(createUserDto);

    return {
      message: '注册成功',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
      },
    };
  }
}
