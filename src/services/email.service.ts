import { Injectable, Inject } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';
import { BusinessException } from '@/common/exceptions/business.exception';
import { ErrorCode } from '@/common/constants/error-codes';

@Injectable()
export class EmailService {
  private transporter: Transporter;
  private static readonly VERIFICATION_CODE_TTL = 5 * 60 * 1000; // 5分钟（毫秒）
  private static readonly VERIFICATION_CODE_PREFIX = 'email:verification:';
  private static readonly PASSWORD_RESET_TTL = 30 * 60 * 1000; // 30分钟（毫秒）
  private static readonly PASSWORD_RESET_PREFIX = 'email:password-reset:';

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    this.logger.setContext({ module: 'EmailService' });
    // 配置邮件传输器
    this.transporter = createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT'),
      secure: this.configService.get<boolean>('MAIL_SECURE'),
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
    });
  }

  /**
   * 生成6位数字验证码
   */
  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 生成密码重置令牌
   */
  private generateResetToken(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15) +
      Date.now().toString(36)
    );
  }

  /**
   * 发送验证码邮件
   */
  async sendVerificationCode(email: string): Promise<void> {
    // 生成验证码
    const code = this.generateVerificationCode();

    // 将验证码存储到缓存中，设置5分钟过期时间
    const cacheKey = `${EmailService.VERIFICATION_CODE_PREFIX}${email}`;
    await this.cache.set(cacheKey, code, EmailService.VERIFICATION_CODE_TTL);

    // 发送邮件
    const mailOptions = {
      from: this.configService.get<string>('MAIL_USER'),
      to: email,
      subject: '注册验证码',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">注册验证码</h2>
          <p>您好！</p>
          <p>您正在注册igCircle Blog 网站，您的验证码是：</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; color: #007bff; letter-spacing: 5px;">${code}</span>
          </div>
          <p>验证码有效期为5分钟，请及时使用。</p>
          <p>如果您没有请求此验证码，请忽略此邮件。</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log('验证码邮件发送成功', {
        action: 'sendVerificationCode',
        metadata: { email, timestamp: new Date().toISOString() },
      });
    } catch (error) {
      // 发送失败时清除缓存中的验证码
      await this.cache.del(cacheKey);
      this.logger.error(
        '发送邮件失败',
        error instanceof Error ? error.stack : undefined,
        {
          metadata: { email, operation: 'sendVerificationCode' },
        },
      );
      throw new BusinessException(
        ErrorCode.EMAIL_SEND_FAILED,
        '发送验证码失败，请稍后重试',
      );
    }
  }

  /**
   * 验证验证码
   */
  async verifyCode(email: string, code: string): Promise<boolean> {
    try {
      const cacheKey = `${EmailService.VERIFICATION_CODE_PREFIX}${email}`;
      const cachedCode = await this.cache.get<string>(cacheKey);

      if (!cachedCode) {
        this.logger.warn('验证码不存在或已过期', {
          action: 'verifyCode',
          metadata: { email, timestamp: new Date().toISOString() },
        });
        throw new BusinessException(
          ErrorCode.EMAIL_VERIFICATION_FAILED,
          '验证码不存在或已过期',
        );
      }

      if (cachedCode !== code) {
        this.logger.warn('验证码错误', {
          action: 'verifyCode',
          metadata: { email, timestamp: new Date().toISOString() },
        });
        throw new BusinessException(
          ErrorCode.EMAIL_VERIFICATION_FAILED,
          '验证码错误',
        );
      }

      // 验证成功后删除缓存中的验证码，防止重复使用
      await this.cache.del(cacheKey);

      this.logger.log('验证码验证成功', {
        action: 'verifyCode',
        metadata: { email, timestamp: new Date().toISOString() },
      });

      return true;
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }

      this.logger.error(
        '验证码验证失败',
        error instanceof Error ? error.stack : String(error),
        {
          metadata: { email, timestamp: new Date().toISOString() },
        },
      );
      throw new BusinessException(
        ErrorCode.EMAIL_VERIFICATION_FAILED,
        '验证码验证失败',
      );
    }
  }

  /**
   * 发送密码重置邮件
   */
  async sendPasswordResetEmail(email: string): Promise<void> {
    // 生成重置令牌
    const resetToken = this.generateResetToken();

    // 将重置令牌存储到缓存中，设置30分钟过期时间
    const cacheKey = `${EmailService.PASSWORD_RESET_PREFIX}${resetToken}`;
    await this.cache.set(cacheKey, email, EmailService.PASSWORD_RESET_TTL);

    // 构建重置链接
    const resetUrl = `${this.configService.get<string>('FRONTEND_URL')}/reset-password?token=${resetToken}`;

    // 发送邮件
    const mailOptions = {
      from: this.configService.get<string>('MAIL_USER'),
      to: email,
      subject: '密码重置',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">密码重置</h2>
          <p>您好！</p>
          <p>您请求重置igCircle Blog账户的密码。请点击下面的链接来重置您的密码：</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">重置密码</a>
          </div>
          <p>或者复制以下链接到浏览器地址栏：</p>
          <p style="word-break: break-all; background-color: #f5f5f5; padding: 10px; border-radius: 3px;">${resetUrl}</p>
          <p>此链接有效期为30分钟，请及时使用。</p>
          <p>如果您没有请求重置密码，请忽略此邮件，您的密码不会被更改。</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log('密码重置邮件发送成功', {
        action: 'sendPasswordResetEmail',
        metadata: { email, timestamp: new Date().toISOString() },
      });
    } catch (error) {
      // 发送失败时清除缓存中的重置令牌
      await this.cache.del(cacheKey);
      this.logger.error(
        '发送密码重置邮件失败',
        error instanceof Error ? error.stack : undefined,
        {
          metadata: { email, operation: 'sendPasswordResetEmail' },
        },
      );
      throw new BusinessException(
        ErrorCode.EMAIL_SEND_FAILED,
        '发送密码重置邮件失败，请稍后重试',
      );
    }
  }

  /**
   * 验证密码重置令牌
   */
  async verifyPasswordResetToken(token: string): Promise<string> {
    try {
      const cacheKey = `${EmailService.PASSWORD_RESET_PREFIX}${token}`;
      const email = await this.cache.get<string>(cacheKey);

      if (!email) {
        this.logger.warn('密码重置令牌不存在或已过期', {
          action: 'verifyPasswordResetToken',
          metadata: { token, timestamp: new Date().toISOString() },
        });
        throw new BusinessException(
          ErrorCode.EMAIL_VERIFICATION_FAILED,
          '密码重置链接无效或已过期',
        );
      }

      this.logger.log('密码重置令牌验证成功', {
        action: 'verifyPasswordResetToken',
        metadata: { email, timestamp: new Date().toISOString() },
      });

      return email;
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }

      this.logger.error(
        '密码重置令牌验证失败',
        error instanceof Error ? error.stack : String(error),
        {
          metadata: { token, timestamp: new Date().toISOString() },
        },
      );
      throw new BusinessException(
        ErrorCode.EMAIL_VERIFICATION_FAILED,
        '密码重置令牌验证失败',
      );
    }
  }

  /**
   * 删除密码重置令牌（重置成功后调用）
   */
  async deletePasswordResetToken(token: string): Promise<void> {
    const cacheKey = `${EmailService.PASSWORD_RESET_PREFIX}${token}`;
    await this.cache.del(cacheKey);
  }
}
