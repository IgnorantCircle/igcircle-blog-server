import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';
import { BusinessException } from '@/common/exceptions/business.exception';
import { ErrorCode } from '@/common/constants/error-codes';

@Injectable()
export class RsaService {
  private privateKey: crypto.KeyObject;
  private publicKey: crypto.KeyObject;
  private privateKeyPem: string;
  private publicKeyPem: string;

  constructor(
    private configService: ConfigService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext({ module: 'RSAService' });
    this.initializeKeys();
  }

  /**
   * 初始化RSA密钥对
   */
  private initializeKeys(): void {
    try {
      let privateKeyPem: string | null = null;

      // 1. 优先从文件读取私钥
      const privateKeyPath = path.join(process.cwd(), 'certs', 'private.pem');
      if (fs.existsSync(privateKeyPath)) {
        privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
        this.logger.log('从文件加载RSA私钥', {
          metadata: { operation: 'initializeKeys', source: 'file' },
        });
      } else {
        // 2. 如果文件不存在，尝试从环境变量获取私钥
        privateKeyPem =
          this.configService.get<string>('RSA_PRIVATE_KEY') || null;
        if (privateKeyPem) {
          this.logger.log('从环境变量加载RSA私钥', {
            metadata: { operation: 'initializeKeys', source: 'env' },
          });
        }
      }

      if (privateKeyPem) {
        // 使用配置的私钥
        this.privateKeyPem = privateKeyPem;
        this.privateKey = crypto.createPrivateKey(privateKeyPem);
        this.publicKey = crypto.createPublicKey(this.privateKey);
        this.publicKeyPem = this.publicKey.export({
          type: 'spki',
          format: 'pem',
        }) as string;
      } else {
        // 生成新的密钥对
        const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem',
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
          },
        });

        this.privateKeyPem = privateKey;
        this.publicKeyPem = publicKey;
        this.privateKey = crypto.createPrivateKey(privateKey);
        this.publicKey = crypto.createPublicKey(publicKey);

        this.logger.warn(
          '警告: 未找到RSA私钥文件或环境变量，已生成临时密钥对。生产环境请配置固定密钥。',
          {
            metadata: { operation: 'initializeKeys', source: 'generated' },
          },
        );
      }

      this.logger.log('RSA密钥初始化成功', {
        metadata: { operation: 'initializeKeys' },
      });
    } catch (error) {
      this.logger.error(
        'RSA密钥初始化失败',
        error instanceof Error ? error.stack : undefined,
        {
          metadata: { operation: 'initializeKeys' },
        },
      );
      throw new BusinessException(
        ErrorCode.COMMON_INTERNAL_ERROR,
        'RSA服务初始化失败',
      );
    }
  }

  /**
   * 获取公钥
   * @returns 公钥字符串
   */
  getPublicKey(): string {
    try {
      return this.publicKeyPem;
    } catch (error) {
      this.logger.error(
        '获取公钥失败',
        error instanceof Error ? error.stack : undefined,
        {
          metadata: { operation: 'getPublicKey' },
        },
      );
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      throw new BusinessException(
        ErrorCode.COMMON_INTERNAL_ERROR,
        `获取公钥失败: ${errorMessage}`,
      );
    }
  }

  /**
   * 解密数据
   * @param encryptedData 加密的数据（base64格式）
   * @returns 解密后的数据
   */
  decrypt(encryptedData: string): string {
    try {
      // 先将base64数据转换为buffer
      const encryptedBuffer = Buffer.from(encryptedData, 'base64');
      // 使用OAEP模式解密
      const decryptedBuffer = crypto.privateDecrypt(
        {
          key: this.privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        encryptedBuffer,
      );
      return decryptedBuffer.toString('utf8');
    } catch (error) {
      this.logger.error(
        'RSA解密失败',
        error instanceof Error ? error.stack : undefined,
        {
          metadata: { operation: 'decrypt' },
        },
      );
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      throw new BusinessException(
        ErrorCode.AUTH_RSA_DECRYPT_FAILED,
        `RSA解密失败: ${errorMessage}`,
      );
    }
  }

  /**
   * 加密数据（主要用于测试）
   * @param data 要加密的数据
   * @returns 加密后的数据
   */
  encrypt(data: string): string {
    try {
      const dataBuffer = Buffer.from(data, 'utf8');
      const encryptedBuffer = crypto.publicEncrypt(
        {
          key: this.publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        dataBuffer,
      );
      return encryptedBuffer.toString('base64');
    } catch (error) {
      this.logger.error(
        'RSA加密失败',
        error instanceof Error ? error.stack : undefined,
        {
          metadata: { operation: 'encrypt' },
        },
      );
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      throw new BusinessException(
        ErrorCode.COMMON_INTERNAL_ERROR,
        `RSA加密失败: ${errorMessage}`,
      );
    }
  }

  /**
   * 验证RSA服务是否正常工作
   * @returns 验证结果
   */
  verifyService(): { success: boolean; message: string } {
    try {
      // 检查密钥对是否存在
      if (!this.privateKey || !this.publicKey) {
        return {
          success: false,
          message: 'RSA密钥对不存在',
        };
      }

      // 检查公钥格式
      const publicKey = this.getPublicKey();
      if (!publicKey || !publicKey.includes('BEGIN PUBLIC KEY')) {
        return {
          success: false,
          message: 'RSA公钥格式错误',
        };
      }

      // 测试加密解密功能
      const testData = 'test-' + Date.now();
      const encrypted = this.encrypt(testData);
      const decrypted = this.decrypt(encrypted);

      if (decrypted !== testData) {
        return {
          success: false,
          message: 'RSA加密解密测试失败',
        };
      }

      return {
        success: true,
        message: 'RSA服务工作正常',
      };
    } catch (error) {
      this.logger.error(
        'RSA服务验证失败',
        error instanceof Error ? error.stack : undefined,
        {
          metadata: { operation: 'verifyService' },
        },
      );
      return {
        success: false,
        message: 'RSA服务验证失败',
      };
    }
  }
}
