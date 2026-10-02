import { FocusService } from './focus.service';
import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
@Module({controllers:[WorkflowController],providers:[WorkflowService,FocusService],exports:[WorkflowService]})
export class WorkflowModule {}

