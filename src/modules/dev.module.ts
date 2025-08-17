import { Module } from '@nestjs/common';
import { DevCacheController } from '@/controllers/dev-cache.controller';
import { DevCacheService } from '@/services/dev-cache.service';
import { CommonModule } from '@/common/common.module';

/**
 * 开发环境模块
 * 仅在开发环境中使用，生产环境需要删除
 */
@Module({
  imports: [CommonModule],
  controllers: [DevCacheController],
  providers: [DevCacheService],
  exports: [DevCacheService],
})
export class DevModule {}
