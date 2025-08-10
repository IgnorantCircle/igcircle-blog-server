import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Request,
  UseInterceptors,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '@/services/user.service';
import { EmailService } from '@/services/email.service';
import { RsaService } from '@/services/rsa.service';
import { Public } from '@/decorators/public.decorator';
import { CurrentUser } from '@/decorators/user.decorator';
import {
  FieldVisibilityInterceptor,
  UsePublicVisibility,
} from '@/common/interceptors/field-visibility.interceptor';
import * as bcrypt from 'bcrypt';
import { User } from '@/entities/user.entity';
import {
  LoginDto,
  LoginResponseDto,
  RegisterDto,
  RegisterResponseDto,
  SendVerificationCodeDto,
  VerificationCodeResponseDto,
  LogoutResponseDto,
} from '@/dto/auth.dto';
import { CreateUserDto, UserStatus } from '@/dto/user.dto';
import {
  BusinessException,
  UnauthorizedException,
  ValidationException,
} from '@/common/exceptions/business.exception';
import { ErrorCode } from '@/common/constants/error-codes';

@ApiTags('认证')
@Controller('/auth')
@UseInterceptors(FieldVisibilityInterceptor)
export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly rsaService: RsaService,
  ) {}

  @Post('login')
  @UsePublicVisibility()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({ status: 200, description: '登录成功', type: LoginResponseDto })
  @ApiResponse({ status: 400, description: '用户名或密码错误' })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    const { username, password } = loginDto;

    // 解密RSA加密的密码
    let decryptedPassword: string;
    try {
      decryptedPassword = this.rsaService.decrypt(password);
    } catch {
      throw new BusinessException(
        ErrorCode.AUTH_RSA_DECRYPT_FAILED,
        '密码解密失败，请刷新页面重试',
      );
    }

    // 查找用户（支持用户名或邮箱登录）
    let user: User | null = null;
    try {
      if (username.includes('@')) {
        user = await this.userService.findByEmail(username);
      } else {
        user = await this.userService.findByUsername(username);
      }

      if (!user) {
        throw new UnauthorizedException(
          ErrorCode.USER_INVALID_CREDENTIALS,
          '用户名或密码错误',
        );
      }
    } catch {
      throw new UnauthorizedException(ErrorCode.USER_INVALID_CREDENTIALS);
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(
      decryptedPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException(
        ErrorCode.USER_INVALID_CREDENTIALS,
        '用户名或密码错误',
      );
    }

    // 检查用户状态
    if (user.status !== UserStatus.ACTIVE.toString()) {
      throw new UnauthorizedException(
        ErrorCode.USER_ACCOUNT_DISABLED,
        '账户已被禁用',
      );
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
      success: true,
      message: '登录成功',
      accessToken: access_token,
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
  @UsePublicVisibility()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '管理员登录' })
  @ApiResponse({ status: 200, description: '登录成功', type: LoginResponseDto })
  @ApiResponse({ status: 400, description: '用户名或密码错误' })
  async adminLogin(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    const result = await this.login(loginDto);

    // 检查是否为管理员
    if (result.user?.role !== 'admin') {
      throw new UnauthorizedException(
        ErrorCode.AUTH_PERMISSION_DENIED,
        '权限不足，需要管理员权限',
      );
    }

    return result;
  }

  @Post('send-verification-code')
  @UsePublicVisibility()
  @Public()
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
      throw new BusinessException(
        ErrorCode.USER_ALREADY_EXISTS,
        '该邮箱已被注册',
      );
    }

    await this.emailService.sendVerificationCode(sendCodeDto.email);

    return {
      message: '验证码已发送到您的邮箱，请查收',
      success: true,
    };
  }

  @Post('register')
  @UsePublicVisibility()
  @Public()
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
      throw new ValidationException('验证码无效或已过期');
    }

    // 解密密码
    const decryptedPassword = this.rsaService.decrypt(registerDto.password);

    // 创建用户DTO
    const createUserDto: CreateUserDto = {
      name: registerDto.username, // 使用用户名作为显示名称
      username: registerDto.username,
      email: registerDto.email,
      password: decryptedPassword,
    };

    // 创建用户
    const user = await this.userService.create(createUserDto);

    return {
      success: true,
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

  @Post('logout')
  @UsePublicVisibility()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户退出登录' })
  @ApiResponse({
    status: 200,
    description: '退出登录成功',
    type: LogoutResponseDto,
  })
  @ApiResponse({ status: 401, description: '未授权访问' })
  async logout(@Request() req: ExpressRequest): Promise<LogoutResponseDto> {
    const token = this.extractTokenFromHeader(req);

    if (token) {
      // 解析token获取过期时间
      try {
        const decoded: unknown = this.jwtService.decode(token);
        if (
          decoded &&
          typeof decoded === 'object' &&
          decoded !== null &&
          'exp' in decoded
        ) {
          const now = Math.floor(Date.now() / 1000);
          const expiresIn = (decoded as { exp: number }).exp - now;

          if (expiresIn > 0) {
            // 将token添加到黑名单
            await this.userService.blacklistToken(token, expiresIn);
          }
        }
      } catch {
        // 如果token解析失败，忽略错误（可能已经是无效token）
      }
    }

    return {
      success: true,
      message: '退出登录成功',
    };
  }

  @Post('logout-all')
  @UsePublicVisibility()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '退出所有设备登录' })
  @ApiResponse({
    status: 200,
    description: '退出所有设备成功',
    type: LogoutResponseDto,
  })
  @ApiResponse({ status: 401, description: '未授权访问' })
  async logoutAll(
    @CurrentUser() user: { sub: string },
  ): Promise<LogoutResponseDto> {
    // 清除用户的所有token（强制退出所有设备）
    await this.userService.clearAllUserTokens(user.sub);

    return {
      success: true,
      message: '已退出所有设备登录',
    };
  }

  private extractTokenFromHeader(request: ExpressRequest): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) return undefined;
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
