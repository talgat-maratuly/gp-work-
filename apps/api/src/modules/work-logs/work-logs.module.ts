import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Section } from '../../entities/section.entity';
import { Task } from '../../entities/task.entity';
import { WorkLog } from '../../entities/work-log.entity';
import { WorkType } from '../../entities/work-type.entity';
import { UsersModule } from '../users/users.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { WorkLogsController } from './work-logs.controller';
import { WorkLogsService } from './work-logs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkLog, Section, WorkType, Task]),
    UsersModule,
    AttendanceModule,
  ],
  controllers: [WorkLogsController],
  providers: [WorkLogsService],
  exports: [WorkLogsService],
})
export class WorkLogsModule {}
