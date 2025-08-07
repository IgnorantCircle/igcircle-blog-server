import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, getErrorMessage } from '@/common/constants/error-codes';

/**
 * 业务异常类
 */
export class BusinessException extends HttpException {
  constructor(
    errorCode: ErrorCode,
    message?: string,
    httpStatus: number = HttpStatus.BAD_REQUEST,
    details?: unknown,
  ) {
    const errorMessage = message || getErrorMessage(errorCode);
    super(
      {
        code: errorCode,
        message: errorMessage,
        details,
        timestamp: new Date().toISOString(),
      },
      httpStatus,
    );
  }
}

/**
 * 资源未找到异常
 */
export class NotFoundException extends BusinessException {
  constructor(
    errorCode: ErrorCode = ErrorCode.COMMON_NOT_FOUND,
    message?: string,
  ) {
    super(errorCode, message, HttpStatus.NOT_FOUND);
  }
}

/**
 * 权限不足异常
 */
export class ForbiddenException extends BusinessException {
  constructor(
    errorCode: ErrorCode = ErrorCode.COMMON_FORBIDDEN,
    message?: string,
  ) {
    super(errorCode, message, HttpStatus.FORBIDDEN);
  }
}

/**
 * 未授权异常
 */
export class UnauthorizedException extends BusinessException {
  constructor(
    errorCode: ErrorCode = ErrorCode.COMMON_UNAUTHORIZED,
    message?: string,
  ) {
    super(errorCode, message, HttpStatus.UNAUTHORIZED);
  }
}

/**
 * 参数验证异常
 */
export class ValidationException extends BusinessException {
  constructor(message?: string, details?: unknown[]) {
    super(
      ErrorCode.COMMON_VALIDATION_FAILED,
      message,
      HttpStatus.BAD_REQUEST,
      details,
    );
  }
}

/**
 * 资源冲突异常
 */
export class ConflictException extends BusinessException {
  constructor(
    errorCode: ErrorCode = ErrorCode.COMMON_CONFLICT,
    message?: string,
  ) {
    super(errorCode, message, HttpStatus.CONFLICT);
  }
}

/**
 * 限流异常
 */
export class RateLimitException extends BusinessException {
  constructor(message?: string) {
    super(
      ErrorCode.COMMON_RATE_LIMIT_EXCEEDED,
      message,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
