import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsBoolean,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { BaseCreateDto, BaseUpdateDto, BaseQueryDto } from './base/base.dto';

import {
  VALIDATION_LIMITS,
  VALIDATION_MESSAGES,
} from '@/common/constants/validation.constants';

/**
 * 用户状态枚举
 */
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BANNED = 'banned',
}

/**
 * 用户角色枚举
 */
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

export class CreateUserDto extends BaseCreateDto {
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

  @ApiProperty({
    description: '邮箱',
  })
  @IsEmail(
    {},
    {
      message: VALIDATION_MESSAGES.INVALID_EMAIL,
    },
  )
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

  @ApiPropertyOptional({
    description: '昵称',
    maxLength: VALIDATION_LIMITS.NICKNAME.MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.NICKNAME.MAX, {
    message: VALIDATION_MESSAGES.MAX_LENGTH(
      '昵称',
      VALIDATION_LIMITS.NICKNAME.MAX,
    ),
  })
  nickname?: string;
}

export class UpdateUserDto extends BaseUpdateDto {
  @ApiPropertyOptional({
    description: '昵称',
    maxLength: VALIDATION_LIMITS.NICKNAME.MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.NICKNAME.MAX, {
    message: VALIDATION_MESSAGES.MAX_LENGTH(
      '昵称',
      VALIDATION_LIMITS.NICKNAME.MAX,
    ),
  })
  nickname?: string;

  @ApiPropertyOptional({
    description: '个人简介',
    maxLength: VALIDATION_LIMITS.BIO.MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.BIO.MAX, {
    message: VALIDATION_MESSAGES.MAX_LENGTH(
      '个人简介',
      VALIDATION_LIMITS.BIO.MAX,
    ),
  })
  bio?: string;

  @ApiPropertyOptional({
    description: '头像URL',
  })
  @IsOptional()
  @IsString()
  avatar?: string;
}

export class UserQueryDto extends BaseQueryDto {
  @ApiPropertyOptional({
    description: '用户状态',
    enum: UserStatus,
  })
  @IsOptional()
  @IsEnum(UserStatus, {
    message: VALIDATION_MESSAGES.INVALID_ENUM('用户状态'),
  })
  status?: UserStatus;

  @ApiPropertyOptional({
    description: '用户角色',
    enum: UserRole,
  })
  @IsOptional()
  @IsEnum(UserRole, {
    message: VALIDATION_MESSAGES.INVALID_ENUM('用户角色'),
  })
  role?: UserRole;

  @ApiPropertyOptional({
    description: '邮箱是否验证',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  emailVerified?: boolean;
}
