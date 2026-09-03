import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ChecklistAnswer,
  ChecklistItem,
  FaceVerification,
  LocationEvent,
  Route,
  RouteStop,
  Section,
  Task,
  WorkExecution,
  WorkExecutionEvent,
  WorkLog,
  WorkPhoto,
  StockMovement,
  WorkDaySession,
} from '../../entities';
import { FieldExecutionsController } from './field-executions.controller';
import { FieldExecutionsService } from './field-executions.service';
import { AttendanceModule } from '../attendance/attendance.module';
import { WorkDaysService } from './work-days.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkExecution,
      WorkExecutionEvent,
      WorkPhoto,
      ChecklistItem,
      ChecklistAnswer,
      FaceVerification,
      LocationEvent,
      Route,
      RouteStop,
      Task,
      Section,
      WorkLog,
      StockMovement,
      WorkDaySession,
    ]),
    AttendanceModule,
  ],
  controllers: [FieldExecutionsController],
  providers: [FieldExecutionsService, WorkDaysService],
  exports: [FieldExecutionsService],
})
export class FieldExecutionsModule {}
