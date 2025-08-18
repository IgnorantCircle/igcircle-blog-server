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
import { BlogCacheService } from '@/common/cache/blog-cache.service';
import { v4 as uuidv4 } from 'uuid';
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
  ForgotPasswordDto,
  ResetPasswordDto,
  PasswordResetResponseDto,
} from '@/dto/auth.dto';
import { CreateUserDto } from '@/dto/user.dto';
import {
  BusinessException,
  UnauthorizedException,
  ValidationException,
} from '@/common/exceptions/business.exception';
import { ErrorCode } from '@/common/constants/error-codes';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';

interface JwtPayload {
  sub: string;
  username: string;
  tokenId: string;
  exp: number;
  iat: number;
}

@ApiTags('4.1 认证API - 登录注册')
@Controller('/auth')
@UseInterceptors(FieldVisibilityInterceptor)
export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly rsaService: RsaService,
    private readonly cacheService: BlogCacheService,
    private readonly logger: StructuredLoggerService,
  ) {}

  @Post('login')
  @UsePublicVisibility()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({ status: 200, description: '登录成功', type: LoginResponseDto })
  @ApiResponse({ status: 400, description: '用户名或密码错误' })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    // 解密密码
    let decryptedPassword: string;
    try {
      decryptedPassword = this.rsaService.decrypt(loginDto.password);
    } catch {
      throw new ValidationException('用户名或密码错误', [
        { field: 'password', message: '用户名或密码错误' },
      ]);
    }

    // 查找用户
    let user: User;
    try {
      user = await this.userService.findByUsername(loginDto.username);
    } catch {
      throw new ValidationException('用户名或密码错误', [
        { field: 'username', message: '用户名或密码错误' },
      ]);
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(
      decryptedPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new ValidationException('用户名或密码错误', [
        { field: 'password', message: '用户名或密码错误' },
      ]);
    }

    // 检查用户状态
    if (user.status !== 'active') {
      throw new UnauthorizedException(
        ErrorCode.USER_ACCOUNT_DISABLED,
        '用户账户已被禁用',
      );
    }

    // 生成JWT token
    const tokenId = uuidv4();
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      jti: tokenId,
    };
    const accessToken = this.jwtService.sign(payload);

    // 将token存储到缓存中
    const decoded = this.jwtService.decode(accessToken);
    if (
      decoded &&
      typeof decoded === 'object' &&
      'exp' in decoded &&
      decoded.exp
    ) {
      const expiresAt = decoded.exp * 1000; // 转换为毫秒
      await this.cacheService.setUserToken(
        user.id,
        tokenId,
        accessToken,
        expiresAt,
        'web-login',
      );
    }

    return {
      success: true,
      message: '登录成功',
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        nickname: user.nickname,
        avatar: user.avatar,
      },
    };
  }

  @Post('admin/login')
  @UsePublicVisibility()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '管理员登录' })
  @ApiResponse({ status: 200, description: '登录成功', type: LoginResponseDto })
  @ApiResponse({ status: 400, description: '用户名或密码错误' })
  async adminLogin(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    // 解密密码
    let decryptedPassword: string;
    try {
      decryptedPassword = this.rsaService.decrypt(loginDto.password);
    } catch {
      throw new ValidationException('用户名或密码错误', [
        { field: 'password', message: '用户名或密码错误' },
      ]);
    }

    // 查找用户
    let user: User;
    try {
      user = await this.userService.findByUsername(loginDto.username);
    } catch {
      throw new ValidationException('用户名或密码错误', [
        { field: 'username', message: '用户名或密码错误' },
      ]);
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(
      decryptedPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new ValidationException('用户名或密码错误', [
        { field: 'password', message: '用户名或密码错误' },
      ]);
    }

    // 检查用户状态
    if (user.status !== 'active') {
      throw new UnauthorizedException(
        ErrorCode.USER_ACCOUNT_DISABLED,
        '用户账户已被禁用',
      );
    }

    // 检查管理员权限
    if (user.role !== 'admin') {
      throw new ValidationException('用户名或密码错误', [
        { field: 'username', message: '用户名或密码错误' },
      ]);
    }

    // 生成JWT token
    const tokenId = uuidv4();
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      jti: tokenId,
    };
    const accessToken = this.jwtService.sign(payload);

    // 将token存储到缓存中
    const decoded = this.jwtService.decode(accessToken);
    if (
      decoded &&
      typeof decoded === 'object' &&
      'exp' in decoded &&
      decoded.exp
    ) {
      const expiresAt = decoded.exp * 1000; // 转换为毫秒
      await this.cacheService.setUserToken(
        user.id,
        tokenId,
        accessToken,
        expiresAt,
        'admin-login',
      );
    }

    return {
      success: true,
      message: '登录成功',
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        nickname: user.nickname,
        avatar: user.avatar,
      },
    };
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
    try {
      await this.emailService.sendVerificationCode(sendCodeDto.email);
      return {
        success: true,
        message: '验证码已发送到您的邮箱，请查收',
      };
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      throw new BusinessException(
        ErrorCode.EMAIL_SEND_FAILED,
        '发送验证码失败，请稍后重试',
      );
    }
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
      throw new ValidationException('验证码错误或已过期', [
        { field: 'verificationCode', message: '验证码错误或已过期' },
      ]);
    }

    // 解密密码
    let decryptedPassword: string;
    try {
      decryptedPassword = this.rsaService.decrypt(registerDto.password);
    } catch {
      throw new ValidationException('密码格式错误', [
        { field: 'password', message: '密码格式错误' },
      ]);
    }

    // 创建用户
    const createUserDto: CreateUserDto = {
      username: registerDto.username,
      email: registerDto.email,
      password: decryptedPassword,
    };

    try {
      const user = await this.userService.create(createUserDto);
      return {
        success: true,
        message: '注册成功',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      };
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      throw new BusinessException(
        ErrorCode.USER_ALREADY_EXISTS,
        '注册失败，请稍后重试',
      );
    }
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
      try {
        const decoded = this.jwtService.decode(token);
        if (
          decoded &&
          typeof decoded === 'object' &&
          'exp' in decoded &&
          decoded.exp
        ) {
          const now = Math.floor(Date.now() / 1000);
          const expiresIn = decoded.exp - now;

          if (expiresIn > 0) {
            // 将token添加到黑名单
            await this.userService.blacklistToken(token, expiresIn);
          }
        }
      } catch {
        this.logger.error('Invalid token', 'AuthService.logout');
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
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  @Post('forgot-password')
  @UsePublicVisibility()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '忘记密码' })
  @ApiResponse({
    status: 200,
    description: '密码重置邮件发送成功',
    type: PasswordResetResponseDto,
  })
  @ApiResponse({ status: 400, description: '邮箱地址无效' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<PasswordResetResponseDto> {
    try {
      // 检查用户是否存在
      const user = await this.userService.findByEmail(forgotPasswordDto.email);
      if (!user) {
        // 为了安全考虑，即使用户不存在也返回成功消息
        // 避免泄露用户信息
        return {
          success: true,
          message: '如果该邮箱地址存在于我们的系统中，您将收到密码重置邮件',
        };
      }

      // 检查用户状态
      if (user.status !== 'active') {
        return {
          success: true,
          message: '如果该邮箱地址存在于我们的系统中，您将收到密码重置邮件',
        };
      }

      // 发送密码重置邮件
      await this.emailService.sendPasswordResetEmail(forgotPasswordDto.email);

      this.logger.log('密码重置邮件发送成功', {
        action: 'forgotPassword',
        metadata: {
          email: forgotPasswordDto.email,
          timestamp: new Date().toISOString(),
        },
      });

      return {
        success: true,
        message: '如果该邮箱地址存在于我们的系统中，您将收到密码重置邮件',
      };
    } catch (error) {
      this.logger.error(
        '发送密码重置邮件失败',
        error instanceof Error ? error.stack : undefined,
        {
          metadata: {
            email: forgotPasswordDto.email,
            operation: 'forgotPassword',
          },
        },
      );

      // 即使发生错误，也返回成功消息以避免信息泄露
      return {
        success: true,
        message: '如果该邮箱地址存在于我们的系统中，您将收到密码重置邮件',
      };
    }
  }

  @Post('reset-password')
  @UsePublicVisibility()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '重置密码' })
  @ApiResponse({
    status: 200,
    description: '密码重置成功',
    type: PasswordResetResponseDto,
  })
  @ApiResponse({ status: 400, description: '验证码错误' })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<PasswordResetResponseDto> {
    try {
      // 验证重置令牌并获取邮箱
      const email = await this.emailService.verifyPasswordResetToken(
        resetPasswordDto.token,
      );

      // 解密新密码
      let decryptedPassword: string;
      try {
        decryptedPassword = this.rsaService.decrypt(
          resetPasswordDto.newPassword,
        );
      } catch {
        throw new ValidationException('密码格式错误', [
          { field: 'newPassword', message: '密码格式错误' },
        ]);
      }

      // 更新用户密码
      await this.userService.updatePassword(email, decryptedPassword);

      // 删除已使用的重置令牌
      await this.emailService.deletePasswordResetToken(resetPasswordDto.token);

      this.logger.log('密码重置成功', {
        action: 'resetPassword',
        metadata: {
          email,
          timestamp: new Date().toISOString(),
        },
      });

      return {
        success: true,
        message: '密码重置成功，请使用新密码登录',
      };
    } catch (error) {
      this.logger.error(
        '密码重置失败',
        error instanceof Error ? error.stack : undefined,
        {
          metadata: {
            operation: 'resetPassword',
            timestamp: new Date().toISOString(),
          },
        },
      );

      if (
        error instanceof BusinessException ||
        error instanceof ValidationException
      ) {
        throw error;
      }

      throw new BusinessException(
        ErrorCode.COMMON_INTERNAL_ERROR,
        '密码重置失败',
      );
    }
  }
}
