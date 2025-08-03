import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 业务异常类
 */
export class BusinessException extends HttpException {
  constructor(
    message: string,
    code: number = HttpStatus.BAD_REQUEST,
    error?: string,
  ) {
    super(
      {
        message,
        error: error || 'Business Error',
        statusCode: code,
      },
      code,
    );
  }
}

/**
 * 资源未找到异常
 */
export class NotFoundException extends BusinessException {
  constructor(resource: string = '资源') {
    super(`${resource}不存在`, HttpStatus.NOT_FOUND, 'Not Found');
  }
}

/**
 * 权限不足异常
 */
export class ForbiddenException extends BusinessException {
  constructor(message: string = '权限不足') {
    super(message, HttpStatus.FORBIDDEN, 'Forbidden');
  }
}

/**
 * 未授权异常
 */
export class UnauthorizedException extends BusinessException {
  constructor(message: string = '未授权访问') {
    super(message, HttpStatus.UNAUTHORIZED, 'Unauthorized');
  }
}

/**
 * 参数验证异常
 */
export class ValidationException extends BusinessException {
  constructor(message: string = '参数验证失败', details?: any[]) {
    super(message, HttpStatus.BAD_REQUEST, 'Validation Error');
    if (details) {
      this.getResponse()['details'] = details;
    }
  }
}

/**
 * 冲突异常
 */
export class ConflictException extends BusinessException {
  constructor(message: string = '资源冲突') {
    super(message, HttpStatus.CONFLICT, 'Conflict');
  }
}
