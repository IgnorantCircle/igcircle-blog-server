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
}
