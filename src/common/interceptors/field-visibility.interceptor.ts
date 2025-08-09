import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  VisibilityContext,
  VISIBILITY_CONTEXT_KEY,
  FIELD_VISIBILITY_KEY,
} from '../decorators/field-visibility.decorator';

/**
 * 字段可见性拦截器
 * 根据当前上下文动态控制响应数据中字段的可见性
 */
@Injectable()
export class FieldVisibilityInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        // 获取当前的可见性上下文
        const visibilityContext = this.getVisibilityContext(context);

        if (!visibilityContext || !data) {
          return data;
        }

        // 处理数据
        return this.filterDataByVisibility(data, visibilityContext);
      }),
    );
  }

  /**
   * 获取当前的可见性上下文
   */
  private getVisibilityContext(
    context: ExecutionContext,
  ): VisibilityContext | null {
    // 首先从方法级别获取
    let visibilityContext = this.reflector.get<VisibilityContext>(
      VISIBILITY_CONTEXT_KEY,
      context.getHandler(),
    );

    // 如果方法级别没有，从类级别获取
    if (!visibilityContext) {
      visibilityContext = this.reflector.get<VisibilityContext>(
        VISIBILITY_CONTEXT_KEY,
        context.getClass(),
      );
    }

    // 如果都没有，根据路径推断
    if (!visibilityContext) {
      const request: { route?: { path: string }; url: string } = context
        .switchToHttp()
        .getRequest();
      const path = request.route?.path || request.url;

      if (path && path.includes('/admin/')) {
        return VisibilityContext.ADMIN;
      } else if (path && path.includes('/public/')) {
        return VisibilityContext.PUBLIC;
      } else if (path && path.includes('/user/')) {
        return VisibilityContext.USER;
      }
    }

    return visibilityContext || VisibilityContext.PUBLIC;
  }

  /**
   * 检查是否为分页数据
   */
  private isPaginatedData(
    data: unknown,
  ): data is { items: unknown[]; total: number } {
    return Boolean(
      data &&
        typeof data === 'object' &&
        'items' in data &&
        'total' in data &&
        Array.isArray((data as { items: unknown[] }).items),
    );
  }

  /**
   * 根据可见性上下文过滤数据
   */
  private filterDataByVisibility(
    data: unknown,
    context: VisibilityContext,
  ): unknown {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // 处理数组
    if (Array.isArray(data)) {
      return data.map((item) => this.filterDataByVisibility(item, context));
    }

    // 处理分页响应
    if (this.isPaginatedData(data)) {
      return {
        ...data,
        items: data.items.map((item) =>
          this.filterDataByVisibility(item, context),
        ),
      };
    }

    // 处理普通对象
    return this.filterObjectByVisibility(
      data as Record<string, unknown>,
      context,
    );
  }

  /**
   * 过滤对象字段
   */
  private filterObjectByVisibility(
    obj: Record<string, unknown>,
    context: VisibilityContext,
  ): Record<string, unknown> {
    if (!obj || typeof obj !== 'object' || obj.constructor === Date) {
      return obj;
    }

    const result: Record<string, unknown> = {};
    const prototype = Object.getPrototypeOf(obj) as object;

    // 获取所有属性（包括继承的）
    const allKeys = new Set([
      ...Object.keys(obj),
      ...Object.getOwnPropertyNames(prototype),
    ]);

    for (const key of allKeys) {
      if (key === 'constructor' || typeof obj[key] === 'function') {
        continue;
      }

      // 检查字段的可见性配置
      const fieldVisibility = this.getFieldVisibility(prototype, key);

      if (this.isFieldVisible(fieldVisibility, context)) {
        const value = obj[key];

        // 递归处理嵌套对象
        if (value && typeof value === 'object') {
          if (Array.isArray(value)) {
            result[key] = value.map((item: unknown) =>
              this.filterDataByVisibility(item, context),
            );
          } else {
            result[key] = this.filterDataByVisibility(value, context);
          }
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * 获取字段的可见性配置
   */
  private getFieldVisibility(
    prototype: object,
    propertyKey: string,
  ): { contexts?: VisibilityContext[] } | null {
    try {
      const metadata = Reflect.getMetadata(
        FIELD_VISIBILITY_KEY,
        prototype,
        propertyKey,
      ) as { contexts?: VisibilityContext[] } | undefined;
      return metadata ?? null;
    } catch {
      return null;
    }
  }

  /**
   * 检查字段是否在当前上下文中可见
   */
  private isFieldVisible(
    fieldVisibility: { contexts?: VisibilityContext[] } | null,
    context: VisibilityContext,
  ): boolean {
    // 如果没有可见性配置，默认可见
    if (!fieldVisibility || !fieldVisibility.contexts) {
      return true;
    }

    // 检查当前上下文是否在允许的上下文列表中
    return fieldVisibility.contexts?.includes(context) ?? false;
  }
}

/**
 * 字段可见性装饰器工厂
 * 用于在控制器方法上设置可见性上下文
 */
export function UseFieldVisibility(context: VisibilityContext) {
  return function (
    target: object,
    propertyKey?: string,
    descriptor?: PropertyDescriptor,
  ) {
    if (propertyKey && descriptor && descriptor.value) {
      // 方法装饰器
      Reflect.defineMetadata(VISIBILITY_CONTEXT_KEY, context, descriptor.value);
    } else {
      // 类装饰器
      Reflect.defineMetadata(VISIBILITY_CONTEXT_KEY, context, target);
    }
  };
}

/**
 * 公共API装饰器
 */
export const UsePublicVisibility = () =>
  UseFieldVisibility(VisibilityContext.PUBLIC);

/**
 * 管理员API装饰器
 */
export const UseAdminVisibility = () =>
  UseFieldVisibility(VisibilityContext.ADMIN);

/**
 * 用户API装饰器
 */
export const UseUserVisibility = () =>
  UseFieldVisibility(VisibilityContext.USER);

/**
 * 内部API装饰器
 */
export const UseInternalVisibility = () =>
  UseFieldVisibility(VisibilityContext.INTERNAL);
