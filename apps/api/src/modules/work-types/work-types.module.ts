import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkType } from '../../entities/work-type.entity';
import { Task } from '../../entities/task.entity';
import { WorkTypesController } from './work-types.controller';
import { WorkTypesService } from './work-types.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkType, Task])],
  controllers: [WorkTypesController],
  providers: [WorkTypesService],
  exports: [WorkTypesService],
})
export class WorkTypesModule {}
