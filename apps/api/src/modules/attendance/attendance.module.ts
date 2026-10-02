import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceRecord } from '../../entities/attendance-record.entity';
import { UsersModule } from '../users/users.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceExportService } from './attendance-export.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceRecord]),
    UsersModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceExportService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
