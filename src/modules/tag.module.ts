import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tag } from '@/entities/tag.entity';
import { AdminTagController } from '@/controllers/admin/tag.controller';
import { TagService } from '@/services/tag.service';
import { AuthModule } from './auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tag]), AuthModule],
  controllers: [AdminTagController],
  providers: [TagService],
  exports: [TagService],
})
export class TagModule {}
