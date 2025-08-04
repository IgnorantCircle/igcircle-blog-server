import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
// 扩展 Express 的 Request 接口以包含 user 属性
interface JwtPayload {
  sub: string;
  username: string;
  [key: string]: any;
}
declare module 'express' {
  interface Request {
    user?: JwtPayload;
  }
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
