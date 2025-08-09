import { Module } from '@nestjs/common';
import { AuthController } from '@/controllers/auth.controller';
import { RsaController } from '@/controllers/rsa.controller';
import { RsaService } from '@/services/rsa.service';
import { EmailService } from '@/services/email.service';

import { SharedAuthModule } from './shared-auth.module';

@Module({
  imports: [SharedAuthModule],
  controllers: [AuthController, RsaController],
  providers: [RsaService, EmailService],
  exports: [SharedAuthModule, RsaService],
})
export class AuthModule {}
