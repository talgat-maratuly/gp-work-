import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WateringRecord } from '../../entities/watering-record.entity';
import { WateringController } from './watering.controller';
import { WateringService } from './watering.service';

@Module({
  imports: [TypeOrmModule.forFeature([WateringRecord])],
  controllers: [WateringController],
  providers: [WateringService],
  exports: [WateringService],
})
export class WateringModule {}
