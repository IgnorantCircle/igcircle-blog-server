import {
  Controller,
  Get,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '@/decorators/public.decorator';
import { RsaService } from '@/services/rsa.service';
import {
  FieldVisibilityInterceptor,
  UsePublicVisibility,
} from '@/common/interceptors/field-visibility.interceptor';

@ApiTags('RSA加密')
@Controller('rsa')
@UseInterceptors(FieldVisibilityInterceptor)
export class RsaController {
  constructor(private readonly rsaService: RsaService) {}

  @Get('public-key')
  @UsePublicVisibility()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取RSA公钥' })
  @ApiResponse({
    status: 200,
    description: '成功获取公钥',
    schema: {
      type: 'object',
      properties: {
        publicKey: {
          type: 'string',
          description: 'RSA公钥',
        },
      },
    },
  })
  getPublicKey(): { publicKey: string } {
    return {
      publicKey: this.rsaService.getPublicKey(),
    };
  }

  @Get('validate')
  @UsePublicVisibility()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '验证RSA服务状态' })
  @ApiResponse({
    status: 200,
    description: 'RSA服务状态',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: '验证是否成功',
        },
        message: {
          type: 'string',
          description: '验证消息',
        },
      },
    },
  })
  validateService(): {
    success: boolean;
    message: string;
  } {
    return this.rsaService.verifyService();
  }
}
