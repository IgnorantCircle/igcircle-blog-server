import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '@/decorators/roles.decorator';
import { Role } from '@/enums/role.enum';
import { User } from '@/entities/user.entity';
import { ForbiddenException } from '@/common/exceptions/business.exception';
import { ErrorCode } from '@/common/constants/error-codes';

// 定义带有 user 属性的请求接口
interface RequestWithUser extends Request {
  user?: User;
}
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request: RequestWithUser = context.switchToHttp().getRequest();
    const { user } = request;

    if (!user) {
      throw new ForbiddenException(ErrorCode.AUTH_USER_INFO_MISSING);
    }

    // 修复类型不匹配问题，将 user.role 转换为 Role 枚举进行比较
    const hasRole = requiredRoles.some(
      (role) => Role[user.role as keyof typeof Role] === Role[role],
    );

    if (!hasRole) {
      throw new ForbiddenException(ErrorCode.AUTH_PERMISSION_DENIED);
    }

    return true;
  }
}
