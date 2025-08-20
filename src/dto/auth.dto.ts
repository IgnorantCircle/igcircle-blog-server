import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  VALIDATION_LIMITS,
  VALIDATION_MESSAGES,
} from '@/common/constants/validation.constants';

export class LoginDto {
  @ApiProperty({ description: '用户名或邮箱' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ description: '是否记住登录状态', default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  rememberMe?: boolean;
}

export class RegisterDto {
  @ApiProperty({
    description: '用户名',
    minLength: VALIDATION_LIMITS.USERNAME.MIN,
    maxLength: VALIDATION_LIMITS.USERNAME.MAX,
  })
  @IsString()
  @MinLength(VALIDATION_LIMITS.USERNAME.MIN, {
    message: VALIDATION_MESSAGES.MIN_LENGTH(
      '用户名',
      VALIDATION_LIMITS.USERNAME.MIN,
    ),
  })
  @MaxLength(VALIDATION_LIMITS.USERNAME.MAX, {
    message: VALIDATION_MESSAGES.MAX_LENGTH(
      '用户名',
      VALIDATION_LIMITS.USERNAME.MAX,
    ),
  })
  username: string;

  @ApiProperty({ description: '邮箱地址' })
  @IsEmail({}, { message: VALIDATION_MESSAGES.INVALID_EMAIL })
  email: string;

  @ApiProperty({
    description: '密码',
    minLength: VALIDATION_LIMITS.PASSWORD.MIN,
    maxLength: VALIDATION_LIMITS.PASSWORD.MAX,
  })
  @IsString()
  @MinLength(VALIDATION_LIMITS.PASSWORD.MIN, {
    message: VALIDATION_MESSAGES.MIN_LENGTH(
      '密码',
      VALIDATION_LIMITS.PASSWORD.MIN,
    ),
  })
  @MaxLength(VALIDATION_LIMITS.PASSWORD.MAX, {
    message: VALIDATION_MESSAGES.MAX_LENGTH(
      '密码',
      VALIDATION_LIMITS.PASSWORD.MAX,
    ),
  })
  password: string;

  @ApiProperty({ description: '验证码', minLength: 6, maxLength: 6 })
  @IsString()
  @Length(
    VALIDATION_LIMITS.VERIFICATION_CODE.MIN,
    VALIDATION_LIMITS.VERIFICATION_CODE.MAX,
    {
      message: VALIDATION_MESSAGES.EXACT_LENGTH(
        '验证码',
        VALIDATION_LIMITS.VERIFICATION_CODE.MIN,
      ),
    },
  )
  verificationCode: string;
}

export class SendVerificationCodeDto {
  @ApiProperty({ description: '邮箱地址' })
  @IsEmail({}, { message: VALIDATION_MESSAGES.INVALID_EMAIL })
  email: string;
}

export class LoginResponseDto {
  @ApiProperty({ description: '是否成功' })
  @Type(() => Boolean)
  success: boolean;

  @ApiProperty({ description: '消息' })
  message: string;

  @ApiPropertyOptional({ description: '用户信息' })
  user?: {
    id: string;
    username: string;
    email: string;
    nickname?: string;
    avatar?: string;
    role: string;
  };

  @ApiPropertyOptional({ description: '访问令牌' })
  accessToken?: string;

  @ApiPropertyOptional({ description: '刷新令牌' })
  refreshToken?: string;
}

export class RegisterResponseDto {
  @ApiProperty({ description: '是否成功' })
  @Type(() => Boolean)
  success: boolean;

  @ApiProperty({ description: '消息' })
  message: string;

  @ApiPropertyOptional({ description: '用户信息' })
  user?: {
    id: string;
    username: string;
    email: string;
    nickname?: string;
    avatar?: string;
    role: string;
  };
}

export class VerificationCodeResponseDto {
  @ApiProperty({ description: '是否成功' })
  @Type(() => Boolean)
  success: boolean;

  @ApiProperty({ description: '消息' })
  message: string;
}

export class LogoutResponseDto {
  @ApiProperty({ description: '是否成功' })
  @Type(() => Boolean)
  success: boolean;

  @ApiProperty({ description: '消息' })
  message: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ description: '邮箱地址' })
  @IsEmail({}, { message: VALIDATION_MESSAGES.INVALID_EMAIL })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: '重置令牌' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: '新密码',
    minLength: VALIDATION_LIMITS.PASSWORD.MIN,
    maxLength: VALIDATION_LIMITS.PASSWORD.MAX,
  })
  @IsString()
  @MinLength(VALIDATION_LIMITS.PASSWORD.MIN, {
    message: VALIDATION_MESSAGES.MIN_LENGTH(
      '密码',
      VALIDATION_LIMITS.PASSWORD.MIN,
    ),
  })
  @MaxLength(VALIDATION_LIMITS.PASSWORD.MAX, {
    message: VALIDATION_MESSAGES.MAX_LENGTH(
      '密码',
      VALIDATION_LIMITS.PASSWORD.MAX,
    ),
  })
  newPassword: string;
}

export class PasswordResetResponseDto {
  @ApiProperty({ description: '是否成功' })
  @Type(() => Boolean)
  success: boolean;

  @ApiProperty({ description: '消息' })
  message: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: '当前密码' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ description: '新密码' })
  @IsString()
  @IsNotEmpty()
  newPassword: string;
}

export class ChangePasswordResponseDto {
  @ApiProperty({ description: '是否成功' })
  @Type(() => Boolean)
  success: boolean;

  @ApiProperty({ description: '消息' })
  message: string;
}
