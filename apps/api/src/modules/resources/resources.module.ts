import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Brigade,
  NurseryBatch,
  NurseryMovement,
  NurseryObject,
  Route,
  Task,
  User,
  Vehicle,
  VehicleAssignment,
  WorkExecution,
} from '../../entities';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vehicle,
      VehicleAssignment,
      NurseryBatch,
      NurseryMovement,
      User,
      Brigade,
      Route,
      Task,
      WorkExecution,
      NurseryObject,
    ]),
  ],
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
