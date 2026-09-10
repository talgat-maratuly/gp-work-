import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AttendanceRecord,
  ChecklistAnswer,
  FaceVerification,
  LocationEvent,
  Route,
  Section,
  StockMovement,
  Vehicle,
  WorkExecution,
  WorkExecutionEvent,
  WorkPhoto,
} from '../../entities';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  imports: [TypeOrmModule.forFeature([
    WorkExecution,
    WorkExecutionEvent,
    WorkPhoto,
    ChecklistAnswer,
    FaceVerification,
    StockMovement,
    Route,
    LocationEvent,
    Section,
    Vehicle,
    AttendanceRecord,
  ])],
  controllers: [OperationsController],
  providers: [OperationsService],
})
export class OperationsModule {}
