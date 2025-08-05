import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

/**
 * 用户端个人资料DTO - 用户查看自己的信息
 */
export class UserProfileDto {
  @ApiProperty({ description: '用户ID' })
  @Expose()
  id: string;

  @ApiProperty({ description: '用户名' })
  @Expose()
  username: string;

  @ApiProperty({ description: '邮箱' })
  @Expose()
  email: string;

  @ApiProperty({ description: '昵称' })
  @Expose()
  nickname: string;

  @ApiProperty({ description: '头像' })
  @Expose()
  avatar: string;

  @ApiProperty({ description: '个人简介' })
  @Expose()
  bio: string;

  @ApiProperty({
    description: '用户状态',
    enum: ['active', 'inactive', 'banned'],
  })
  @Expose()
  status: string;

  @ApiProperty({ description: '创建时间' })
  @Expose()
  @Transform(({ value }) =>
    typeof value === 'number' ? new Date(value).toISOString() : value,
  )
  createdAt: number;

  @ApiProperty({ description: '更新时间' })
  @Expose()
  @Transform(({ value }) =>
    typeof value === 'number' ? new Date(value).toISOString() : value,
  )
  updatedAt: number;

  // 隐藏敏感信息
  @Exclude()
  password: string;

  @Exclude()
  role: string;
}

/**
 * 用户端其他用户信息DTO - 查看其他用户的公开信息
 */
export class UserPublicDto {
  @ApiProperty({ description: '用户ID' })
  @Expose()
  id: string;

  @ApiProperty({ description: '用户名' })
  @Expose()
  username: string;

  @ApiProperty({ description: '昵称' })
  @Expose()
  nickname: string;

  @ApiProperty({ description: '头像' })
  @Expose()
  avatar: string;

  @ApiProperty({ description: '个人简介' })
  @Expose()
  bio: string;

  @ApiProperty({ description: '创建时间' })
  @Expose()
  @Transform(({ value }) =>
    typeof value === 'number' ? new Date(value).toISOString() : value,
  )
  createdAt: number;

  // 隐藏敏感信息
  @Exclude()
  email: string;

  @Exclude()
  password: string;

  @Exclude()
  role: string;

  @Exclude()
  status: string;

  @Exclude()
  updatedAt: number;
}