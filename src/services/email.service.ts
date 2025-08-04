import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { createTransport, Transporter } from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private transporter: Transporter;

  constructor(
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
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
    // 检查是否在冷却期内
    const cooldownKey = `email_cooldown:${email}`;
    const lastSent = await this.cacheManager.get(cooldownKey);

    if (lastSent) {
      throw new BadRequestException('请等待60秒后再次发送验证码');
    }

    // 生成验证码
    const code = this.generateVerificationCode();

    // 存储验证码到缓存，有效期5分钟
    const cacheKey = `verification_code:${email}`;
    await this.cacheManager.set(cacheKey, code, 5 * 60 * 1000); // 5分钟

    // 设置冷却期，60秒
    await this.cacheManager.set(cooldownKey, Date.now(), 60 * 1000); // 60秒

    // 发送邮件
    const mailOptions = {
      from: this.configService.get<string>('MAIL_USER', 'igcircle@163.com'),
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
    } catch (error) {
      console.error('发送邮件失败:', error);
      throw new BadRequestException('发送验证码失败，请稍后重试');
    }
  }

  /**
   * 验证验证码
   */
  async verifyCode(email: string, code: string): Promise<boolean> {
    const cacheKey = `verification_code:${email}`;
    const storedCode = await this.cacheManager.get<string>(cacheKey);

    if (!storedCode) {
      return false;
    }

    if (storedCode === code) {
      // 验证成功后删除验证码
      await this.cacheManager.del(cacheKey);
      return true;
    }

    return false;
  }
}
