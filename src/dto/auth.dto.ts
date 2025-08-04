import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '@/entities/user.entity';

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

export class RegisterDto {
  @ApiProperty({ description: '用户名', minLength: 3, maxLength: 50 })
  @IsString()
  @MinLength(3, { message: '用户名至少3个字符' })
  @MaxLength(50, { message: '用户名最多50个字符' })
  username: string;

  @ApiProperty({ description: '邮箱地址' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @ApiProperty({ description: '密码', minLength: 6, maxLength: 255 })
  @IsString()
  @MinLength(6, { message: '密码至少6个字符' })
  @MaxLength(255, { message: '密码最多255个字符' })
  password: string;

  @ApiProperty({ description: '验证码', minLength: 6, maxLength: 6 })
  @IsString()
  @Length(6, 6, { message: '验证码必须是6位数字' })
  verificationCode: string;
}

export class SendVerificationCodeDto {
  @ApiProperty({ description: '邮箱地址' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;
}

export class LoginResponseDto {
  @ApiProperty({ description: '访问令牌' })
  access_token: string;

  @ApiProperty({ description: '用户信息' })
  user: Pick<User, 'id' | 'username' | 'email' | 'nickname' | 'role'>;
}

export class RegisterResponseDto {
  @ApiProperty({ description: '注册成功消息' })
  message: string;

  @ApiProperty({ description: '用户信息' })
  user: Pick<User, 'id' | 'username' | 'email' | 'nickname' | 'role'>;
}

export class VerificationCodeResponseDto {
  @ApiProperty({ description: '响应消息' })
  message: string;
}