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
} from '../../entities';
import { FieldExecutionsController } from './field-executions.controller';
import { FieldExecutionsService } from './field-executions.service';
import { AttendanceModule } from '../attendance/attendance.module';

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
    ]),
    AttendanceModule,
  ],
  controllers: [FieldExecutionsController],
  providers: [FieldExecutionsService],
  exports: [FieldExecutionsService],
})
export class FieldExecutionsModule {}
