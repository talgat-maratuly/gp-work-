import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminDailyReport } from '../../entities/admin-daily-report.entity';
import { AttendanceRecord } from '../../entities/attendance-record.entity';
import { Task } from '../../entities/task.entity';
import { WateringRecord } from '../../entities/watering-record.entity';
import { AdminReportsController } from './admin-reports.controller';
import { AdminReportsService } from './admin-reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminDailyReport,
      Task,
      WateringRecord,
      AttendanceRecord,
    ]),
  ],
  controllers: [AdminReportsController],
  providers: [AdminReportsService],
  exports: [AdminReportsService],
})
export class AdminReportsModule {}
