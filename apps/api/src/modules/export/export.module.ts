import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { WorkLogsModule } from '../work-logs/work-logs.module';
import { AttendanceRecord } from '../../entities/attendance-record.entity';

@Module({
  imports: [WorkLogsModule, TypeOrmModule.forFeature([AttendanceRecord])],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
