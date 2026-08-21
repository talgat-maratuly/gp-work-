import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Section } from '../../entities/section.entity';
import { QrController } from './qr.controller';
import { QrService } from './qr.service';

@Module({
  imports: [TypeOrmModule.forFeature([Section])],
  controllers: [QrController],
  providers: [QrService],
})
export class QrModule {}
