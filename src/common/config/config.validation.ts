import { plainToClass, Transform, Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsEmail,
  Min,
  Max,
  validateSync,
  IsPort,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { ValidationException } from '../exceptions/business.exception';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

enum LogLevel {
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
  Verbose = 'verbose',
}

enum DatabaseType {
  MySQL = 'mysql',
  PostgreSQL = 'postgres',
  SQLite = 'sqlite',
}

class DatabaseConfig {
  @IsEnum(DatabaseType)
  @IsNotEmpty()
  type: DatabaseType;

  @IsString()
  @IsNotEmpty()
  host: string;

  @IsPort()
  @Transform(({ value }) => parseInt(value, 10))
  port: number;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  database: string;

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  synchronize?: boolean = false;

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  logging?: boolean = false;

  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  maxConnections?: number = 10;

  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  connectionTimeout?: number = 30000;
}

class JwtConfig {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9+/=]{32,}$/, {
    message:
      'JWT secret must be at least 32 characters long and contain only valid base64 characters',
  })
  secret: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d+[smhd]$/, {
    message: 'JWT expiration must be in format like "1h", "30m", "7d"',
  })
  expiresIn?: string = '1h';

  @IsString()
  @IsOptional()
  @Matches(/^\d+[smhd]$/, {
    message: 'JWT refresh expiration must be in format like "1h", "30m", "7d"',
  })
  refreshExpiresIn?: string = '7d';
}

class EmailConfig {
  @IsString()
  @IsNotEmpty()
  host: string;

  @IsPort()
  @Transform(({ value }) => parseInt(value, 10))
  port: number;

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  secure?: boolean = false;

  @IsEmail()
  @IsNotEmpty()
  user: string;

  @IsString()
  @IsNotEmpty()
  pass: string;

  @IsEmail()
  @IsOptional()
  from?: string;
}

class RateLimitConfig {
  @IsNumber()
  @Min(1000)
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  windowMs?: number = 60000; // 1分钟

  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  max?: number = 100;

  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  authMax?: number = 5; // 认证相关接口限制
}

class SecurityConfig {
  @IsString()
  @IsNotEmpty()
  rsaPrivateKeyPath: string;

  @IsString()
  @IsNotEmpty()
  rsaPublicKeyPath: string;

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  enableCors?: boolean = true;

  @IsString()
  @IsOptional()
  corsOrigin?: string = '*';

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  enableHelmet?: boolean = true;
}

class LoggingConfig {
  @IsEnum(LogLevel)
  @IsOptional()
  level?: LogLevel = LogLevel.Info;

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  enableConsole?: boolean = true;

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  enableFile?: boolean = false;

  @IsString()
  @IsOptional()
  filePath?: string = './logs';

  @IsNumber()
  @Min(1)
  @Max(365)
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  maxFiles?: number = 14; // 保留14天的日志

  @IsString()
  @IsOptional()
  @Matches(/^\d+[kmg]b?$/i, {
    message: 'Max file size must be in format like "10mb", "1gb"',
  })
  maxFileSize?: string = '20mb';
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV?: Environment = Environment.Development;

  @IsNumber()
  @Min(1)
  @Max(65535)
  @Transform(({ value }) => (value ? parseInt(value, 10) : 3000))
  @IsOptional()
  PORT?: number = 3000;

  @IsString()
  @IsOptional()
  API_PREFIX?: string = 'api';

  @IsString()
  @IsOptional()
  API_VERSION?: string = 'v1';

  @Type(() => DatabaseConfig)
  database: DatabaseConfig;

  @Type(() => JwtConfig)
  jwt: JwtConfig;

  @Type(() => EmailConfig)
  @IsOptional()
  email?: EmailConfig;

  @Type(() => RateLimitConfig)
  @IsOptional()
  rateLimit?: RateLimitConfig;

  @Type(() => SecurityConfig)
  security: SecurityConfig;

  @Type(() => LoggingConfig)
  @IsOptional()
  logging?: LoggingConfig;

  // 文件上传配置
  @IsString()
  @IsOptional()
  UPLOAD_PATH?: string = './uploads';

  @IsNumber()
  @Min(1024) // 最小1KB
  @Max(100 * 1024 * 1024) // 最大100MB
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  MAX_FILE_SIZE?: number = 10 * 1024 * 1024; // 10MB

  // 分页配置
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  DEFAULT_PAGE_SIZE?: number = 10;

  @IsNumber()
  @Min(10)
  @Max(1000)
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  MAX_PAGE_SIZE?: number = 100;
}

/**
 * 验证环境变量配置
 */
export function validateConfig(
  config: Record<string, unknown>,
): EnvironmentVariables {
  // 转换嵌套配置
  const transformedConfig = {
    NODE_ENV: config.NODE_ENV,
    PORT: config.PORT ? parseInt(config.PORT as string, 10) : 3000,
    API_PREFIX: config.API_PREFIX,
    API_VERSION: config.API_VERSION,
    UPLOAD_PATH: config.UPLOAD_PATH,
    MAX_FILE_SIZE: config.MAX_FILE_SIZE
      ? parseInt(config.MAX_FILE_SIZE as string, 10)
      : 10485760,
    DEFAULT_PAGE_SIZE: config.DEFAULT_PAGE_SIZE
      ? parseInt(config.DEFAULT_PAGE_SIZE as string, 10)
      : 10,
    MAX_PAGE_SIZE: config.MAX_PAGE_SIZE
      ? parseInt(config.MAX_PAGE_SIZE as string, 10)
      : 100,
    database: {
      type: config.DB_TYPE || 'mysql',
      host: config.DB_HOST || 'localhost',
      port: config.DB_PORT ? parseInt(config.DB_PORT as string, 10) : 3306,
      username: config.DB_USER || 'root',
      password: config.DB_PASS || '',
      database: config.DB_NAME || 'blog',
      synchronize: config.DB_SYNCHRONIZE === 'true',
      logging: config.DB_LOGGING === 'true',
      maxConnections: config.DB_MAX_CONNECTIONS
        ? parseInt(config.DB_MAX_CONNECTIONS as string, 10)
        : 10,
      acquireTimeout: config.DB_CONNECTION_TIMEOUT
        ? parseInt(config.DB_CONNECTION_TIMEOUT as string, 10)
        : 60000,
    },
    jwt: {
      secret: config.JWT_SECRET || 'default-secret-key-change-in-production',
      expiresIn: config.JWT_EXPIRES_IN || '1h',
      refreshExpiresIn: config.JWT_REFRESH_EXPIRES_IN || '7d',
    },
    email: config.EMAIL_HOST
      ? {
          host: config.EMAIL_HOST,
          port: config.EMAIL_PORT || 587,
          secure: config.EMAIL_SECURE || false,
          user: config.EMAIL_USER,
          pass: config.EMAIL_PASS,
          from: config.EMAIL_FROM,
        }
      : undefined,
    rateLimit: {
      windowMs: config.RATE_LIMIT_WINDOW_MS || 60000,
      max: config.RATE_LIMIT_MAX || 100,
      authMax: config.RATE_LIMIT_AUTH_MAX || 5,
    },
    security: {
      rsaPrivateKeyPath: config.RSA_PRIVATE_KEY_PATH || './keys/private.pem',
      rsaPublicKeyPath: config.RSA_PUBLIC_KEY_PATH || './keys/public.pem',
      enableCors: config.ENABLE_CORS !== 'false',
      corsOrigin: config.CORS_ORIGIN || '*',
      enableHelmet: config.ENABLE_HELMET !== 'false',
    },
    logging: {
      level: config.LOG_LEVEL || 'info',
      enableConsole: config.LOG_ENABLE_CONSOLE !== 'false',
      enableFile: config.LOG_ENABLE_FILE === 'true',
      filePath: config.LOG_FILE_PATH || './logs',
      maxFiles: config.LOG_MAX_FILES || 14,
      maxFileSize: config.LOG_MAX_FILE_SIZE || '20mb',
    },
  };

  const validatedConfig = plainToClass(
    EnvironmentVariables,
    transformedConfig,
    {
      enableImplicitConversion: true,
    },
  );

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
    whitelist: false,
    forbidNonWhitelisted: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((error) => {
        const constraints = Object.values(error.constraints || {});
        return `${error.property}: ${constraints.join(', ')}`;
      })
      .join('; ');

    throw new ValidationException(`配置验证失败: ${errorMessages}`);
  }

  return validatedConfig;
}

/**
 * 获取配置工厂函数
 */
export const configFactory = () => {
  return validateConfig(process.env as Record<string, unknown>);
};
