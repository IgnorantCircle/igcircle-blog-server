import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Exclude, Transform } from 'class-transformer';
import { Type } from 'class-transformer';

/**
 * 字段可见性上下文类型
 */
export enum VisibilityContext {
  PUBLIC = 'public', // 公共API
  ADMIN = 'admin', // 管理员API
  USER = 'user', // 用户API
  INTERNAL = 'internal', // 内部使用
}

/**
 * 字段可见性选项
 */
export interface FieldVisibilityOptions {
  /** 可见的上下文 */
  contexts: VisibilityContext[];
  /** API文档描述 */
  description?: string;
  /** 是否为可选字段 */
  optional?: boolean;
  /** 字段类型 */
  type?: unknown;
  /** 示例值 */
  example?: unknown;
  /** 转换函数 */
  transform?: (value: unknown) => unknown;
  /** 是否为数组 */
  isArray?: boolean;
}

/**
 * 当前可见性上下文的元数据键
 */
export const VISIBILITY_CONTEXT_KEY = 'visibility_context';

/**
 * 字段可见性元数据键
 */
export const FIELD_VISIBILITY_KEY = 'field_visibility';

/**
 * 设置当前响应的可见性上下文
 */
export function SetVisibilityContext(context: VisibilityContext) {
  return SetMetadata(VISIBILITY_CONTEXT_KEY, context);
}

/**
 * 字段可见性装饰器
 * 根据不同的上下文动态控制字段的可见性
 */
export function FieldVisibility(options: FieldVisibilityOptions) {
  const decorators: PropertyDecorator[] = [];

  // 设置字段可见性元数据
  decorators.push(SetMetadata(FIELD_VISIBILITY_KEY, options));

  // 根据上下文设置 Expose/Exclude
  // 注意：这里我们先设置为 Expose，实际的可见性控制在拦截器中处理
  decorators.push(Expose());

  // 设置 API 文档
  const apiOptions: any = {};

  if (options.description !== undefined) {
    apiOptions.description = options.description;
  }
  if (options.type !== undefined) {
    apiOptions.type = options.type;
  }
  if (options.example !== undefined) {
    apiOptions.example = options.example;
  }
  if (options.isArray !== undefined) {
    apiOptions.isArray = options.isArray;
  }

  if (options.optional) {
    decorators.push(ApiPropertyOptional(apiOptions));
  } else {
    decorators.push(ApiProperty(apiOptions));
  }

  // 设置转换函数
  if (options.transform) {
    decorators.push(
      Transform(({ value }) => {
        return (options.transform as (value: unknown) => unknown)(value);
      }),
    );
  }

  // 设置类型转换
  if (options.type && !options.isArray) {
    decorators.push(Type(() => options.type as Function));
  }

  return applyDecorators(...decorators);
}

/**
 * 公共字段装饰器 - 在所有上下文中可见
 */
export function PublicField(options: Omit<FieldVisibilityOptions, 'contexts'>) {
  return FieldVisibility({
    ...options,
    contexts: [
      VisibilityContext.PUBLIC,
      VisibilityContext.ADMIN,
      VisibilityContext.USER,
      VisibilityContext.INTERNAL,
    ],
  });
}

/**
 * 管理员字段装饰器 - 仅在管理员上下文中可见
 */
export function AdminField(options: Omit<FieldVisibilityOptions, 'contexts'>) {
  return FieldVisibility({
    ...options,
    contexts: [VisibilityContext.ADMIN, VisibilityContext.INTERNAL],
  });
}

/**
 * 用户字段装饰器 - 在用户和管理员上下文中可见
 */
export function UserField(options: Omit<FieldVisibilityOptions, 'contexts'>) {
  return FieldVisibility({
    ...options,
    contexts: [
      VisibilityContext.USER,
      VisibilityContext.ADMIN,
      VisibilityContext.INTERNAL,
    ],
  });
}

/**
 * 内部字段装饰器 - 仅在内部使用
 */
export function InternalField(
  options: Omit<FieldVisibilityOptions, 'contexts'>,
) {
  return FieldVisibility({
    ...options,
    contexts: [VisibilityContext.INTERNAL],
  });
}

/**
 * 敏感字段装饰器 - 永远不暴露
 */
export function SensitiveField() {
  return applyDecorators(
    Exclude(),
    SetMetadata(FIELD_VISIBILITY_KEY, { contexts: [] }),
  );
}

/**
 * 条件字段装饰器 - 根据条件动态显示
 */
export function ConditionalField(
  condition: (context: VisibilityContext, data: any) => boolean,
  options: Omit<FieldVisibilityOptions, 'contexts'>,
) {
  return FieldVisibility({
    ...options,
    contexts: [
      VisibilityContext.PUBLIC,
      VisibilityContext.ADMIN,
      VisibilityContext.USER,
      VisibilityContext.INTERNAL,
    ],
    transform: (value: unknown) => {
      // 条件逻辑将在拦截器中处理
      return options.transform ? options.transform(value) : value;
    },
  });
}

/**
 * 时间字段装饰器 - 自动处理时间格式转换
 */
export function TimeField(
  contexts: VisibilityContext[],
  options?: Partial<Omit<FieldVisibilityOptions, 'contexts' | 'transform'>>,
) {
  return FieldVisibility({
    ...options,
    contexts,
    transform: (value: unknown) => {
      if (!value) return null;
      return typeof value === 'number' ? new Date(value).toISOString() : value;
    },
  });
}

/**
 * 统计字段装饰器 - 用于统计数据
 */
export function StatsField(
  contexts: VisibilityContext[] = [
    VisibilityContext.ADMIN,
    VisibilityContext.INTERNAL,
  ],
  options?: Partial<Omit<FieldVisibilityOptions, 'contexts'>>,
) {
  return FieldVisibility({
    type: Number,
    ...options,
    contexts,
  });
}

/**
 * 关系字段装饰器 - 用于关联数据
 */
export function RelationField(
  type: unknown,
  contexts: VisibilityContext[],
  options?: Partial<Omit<FieldVisibilityOptions, 'contexts' | 'type'>>,
) {
  return FieldVisibility({
    ...options,
    type: type as any,
    contexts,
  });
}

/**
 * 数组关系字段装饰器
 */
export function RelationArrayField(
  type: unknown,
  contexts: VisibilityContext[],
  options?: Partial<
    Omit<FieldVisibilityOptions, 'contexts' | 'type' | 'isArray'>
  >,
) {
  return FieldVisibility({
    ...options,
    type: type as any,
    contexts,
    isArray: true,
  });
}
