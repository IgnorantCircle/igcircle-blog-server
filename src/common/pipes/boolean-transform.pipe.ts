import {
  Injectable,
  ArgumentMetadata,
  PipeTransform,
  Type,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import 'reflect-metadata';

@Injectable()
export class BooleanTransformPipe implements PipeTransform {
  constructor(private reflector: Reflector) {}

  private convertBooleansPrecise(obj: any, dtoClass?: Type<any>): any {
    if (!dtoClass || typeof obj !== 'object' || obj === null) return obj;

    const result: Record<string, any> = { ...(<Record<string, any>>obj) };
    for (const key of Object.keys(result)) {
      // 使用类型断言处理 Reflect.getMetadata 返回的 any 类型
      const fieldType = Reflect.getMetadata(
        'design:type',
        dtoClass.prototype,
        key,
      ) as Type<any> | undefined;
      if (fieldType === Boolean && typeof result[key] === 'string') {
        const val = result[key].toLowerCase();
        if (val === 'true') result[key] = true;
        else if (val === 'false') result[key] = false;
      }
    }
    return result;
  }

  transform(value: any, metadata: ArgumentMetadata): any {
    if (!metadata.metatype || typeof metadata.metatype !== 'function') {
      return value; // 非 DTO 类不处理
    }
    return this.convertBooleansPrecise(value, metadata.metatype);
  }
}
