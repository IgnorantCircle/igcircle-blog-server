import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@/entities/user.entity';
import { Request } from 'express';

// 扩展 Express 的 Request 接口以包含 user 属性
declare module 'express' {
  interface Request {
    user?: User;
  }
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
