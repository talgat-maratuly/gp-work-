import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Section } from '../../entities/section.entity';
import { Task } from '../../entities/task.entity';
import { WorkLog } from '../../entities/work-log.entity';
import { UsersModule } from '../users/users.module';
import { WorkLogsController } from './work-logs.controller';
import { WorkLogsService } from './work-logs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkLog, Section, Task]),
    UsersModule,
  ],
  controllers: [WorkLogsController],
  providers: [WorkLogsService],
  exports: [WorkLogsService],
})
export class WorkLogsModule {}
