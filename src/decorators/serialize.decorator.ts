import { SetMetadata } from '@nestjs/common';
import { ClassConstructor } from 'class-transformer';

export const SERIALIZE_KEY = 'serialize';

/**
 * 序列化装饰器
 * 用于指定响应数据的序列化类型
 */
export const Serialize = <T>(dto: ClassConstructor<T>) =>
  SetMetadata(SERIALIZE_KEY, dto);
