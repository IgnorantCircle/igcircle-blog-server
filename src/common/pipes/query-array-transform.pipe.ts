import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

/**
 * 通用查询数组参数转换管道工厂函数
 * 将 URL 中的数组参数格式（如 tagIds[]）转换为标准属性名（如 tagIds）
 */
export function createQueryArrayTransformPipe(arrayFields: string[] = []) {
  @Injectable()
  class QueryArrayTransformPipe implements PipeTransform {
    transform(
      value: Record<string, any>,
      metadata: ArgumentMetadata,
    ): Record<string, any> {
      if (metadata.type !== 'query' || !value || typeof value !== 'object') {
        return value;
      }

      const transformed: Record<string, any> = { ...value };

      // 处理指定的数组字段
      arrayFields.forEach((field) => {
        const arrayKey = `${field}[]`;
        // 处理 field[] 格式的参数
        if (value[arrayKey]) {
          transformed[field] = Array.isArray(value[arrayKey])
            ? value[arrayKey]
            : [value[arrayKey]];
          delete transformed[arrayKey];
        }
        // 处理单值参数，将其转换为数组
        else if (value[field] && !Array.isArray(value[field])) {
          transformed[field] = [value[field]];
        }
      });

      // 自动检测并处理其他数组参数（以[]结尾的参数）
      Object.keys(value).forEach((key) => {
        if (
          key.endsWith('[]') &&
          !arrayFields.some((field) => key === `${field}[]`)
        ) {
          const fieldName = key.slice(0, -2); // 移除 []
          transformed[fieldName] = Array.isArray(value[key])
            ? value[key]
            : [value[key]];
          delete transformed[key];
        }
      });

      return transformed;
    }
  }

  return QueryArrayTransformPipe;
}

/**
 * 默认的查询数组参数转换管道
 * 处理常见的数组参数：tagIds, categoryIds, userIds, articleIds 等
 */
export const QueryArrayTransformPipe = createQueryArrayTransformPipe([
  'tagIds',
  'categoryIds',
  'userIds',
  'articleIds',
  'commentIds',
  'ids',
]);
