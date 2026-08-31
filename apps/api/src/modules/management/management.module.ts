import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManagementDecision } from '../../entities/management-decision.entity';
import { ScheduleEntry } from '../../entities/schedule-entry.entity';
import { Task } from '../../entities/task.entity';
import { WateringRecord } from '../../entities/watering-record.entity';
import { ManagementController } from './management.controller';
import { ManagementService } from './management.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ManagementDecision,
      Task,
      WateringRecord,
      ScheduleEntry,
    ]),
  ],
  controllers: [ManagementController],
  providers: [ManagementService],
  exports: [ManagementService],
})
export class ManagementModule {}
