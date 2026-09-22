import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Section } from '../../entities/section.entity';
import { QrController } from './qr.controller';
import { QrService } from './qr.service';
import { FormSettingsModule } from '../form-settings/form-settings.module';

@Module({
  imports: [TypeOrmModule.forFeature([Section]), FormSettingsModule],
  controllers: [QrController],
  providers: [QrService],
})
export class QrModule {}
