import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '@/decorators/public.decorator';
import { UserService } from '@/services/user.service';
import { User } from '@/entities/user.entity';
import { UnauthorizedException } from '@/common/exceptions/business.exception';
import { ErrorCode } from '@/common/constants/error-codes';

interface JwtPayload {
  sub: string;
  username: string;
  iat?: number; // token签发时间
  exp?: number; // token过期时间
  [key: string]: any;
}

// 使用交叉类型而不是扩展 Request 接口
type RequestWithUser = Request & { user?: User & JwtPayload };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private configService: ConfigService,
    private userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request: RequestWithUser = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException(ErrorCode.AUTH_TOKEN_MISSING);
    }

    try {
      const payload: JwtPayload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // 检查token是否在黑名单中
      try {
        const isBlacklisted = await this.userService.isTokenBlacklisted(token);
        if (isBlacklisted) {
          throw new UnauthorizedException(ErrorCode.AUTH_TOKEN_EXPIRED);
        }
      } catch (error) {
        // 黑名单检查失败时记录日志但不阻止认证
        console.warn('Token blacklist check failed:', error);
        // 如果是UnauthorizedException，则重新抛出
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        // 其他错误不阻止认证流程
      }

      // 检查用户是否被强制退出
      if (payload.iat) {
        try {
          const isForcedLogout = await this.userService.isUserForcedLogout(
            payload.sub,
            payload.iat * 1000, // 转换为毫秒
          );
          if (isForcedLogout) {
            throw new UnauthorizedException(ErrorCode.AUTH_FORCED_LOGOUT);
          }
        } catch (error) {
          // 强制退出检查失败时记录日志但不阻止认证
          console.warn('Force logout check failed:', error);
        }
      }

      // 更新用户最后活跃时间（失败时不影响认证）
      try {
        await this.userService.updateUserLastActive(payload.sub);
      } catch (error) {
        // 更新活跃时间失败时记录日志但不阻止认证
        console.warn('Update last active failed:', error);
      }

      // 获取用户信息并附加到请求对象
      const user = await this.userService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException(ErrorCode.USER_NOT_FOUND);
      }

      // 将用户信息和JWT payload合并附加到请求对象
      request['user'] = { ...user, ...payload } as User & JwtPayload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(ErrorCode.AUTH_TOKEN_INVALID);
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
