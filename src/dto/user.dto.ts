import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationSortDto } from '@/common/dto/pagination.dto';

export class CreateUserDto {
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

  @ApiPropertyOptional({ description: '昵称', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: '昵称最多50个字符' })
  nickname?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ description: '昵称', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: '昵称最多50个字符' })
  nickname?: string;

  @ApiPropertyOptional({ description: '个人简介', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '个人简介最多500个字符' })
  bio?: string;

  @ApiPropertyOptional({ description: '头像URL' })
  @IsOptional()
  @IsString()
  avatar?: string;
}

export class UserQueryDto extends PaginationSortDto {
  @ApiPropertyOptional({
    description: '用户状态',
    enum: ['active', 'inactive', 'banned'],
  })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'banned'])
  status?: string;

  @ApiPropertyOptional({ description: '用户角色', enum: ['user', 'admin'] })
  @IsOptional()
  @IsEnum(['user', 'admin'])
  role?: string;

  @ApiPropertyOptional({ description: '搜索关键词' })
  @IsOptional()
  @IsString()
  keyword?: string;
}
