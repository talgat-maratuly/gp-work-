import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Brigade } from '../../entities/brigade.entity';
import { NurseryObject } from '../../entities/nursery-object.entity';
import { ScheduleEntry } from '../../entities/schedule-entry.entity';
import { Section } from '../../entities/section.entity';
import { Task } from '../../entities/task.entity';
import { User } from '../../entities/user.entity';
import { WateringRecord } from '../../entities/watering-record.entity';
import { ManagementModule } from '../management/management.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NurseryObject,
      Section,
      Task,
      WateringRecord,
      ScheduleEntry,
      Brigade,
      User,
    ]),
    ManagementModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
