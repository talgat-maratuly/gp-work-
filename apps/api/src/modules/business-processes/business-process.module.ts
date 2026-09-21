import { Module } from '@nestjs/common';
import { WorkflowModule } from '../workflow/workflow.module';
import { BusinessProcessController } from './business-process.controller';
import { BusinessProcessService } from './business-process.service';

@Module({ imports: [WorkflowModule], controllers: [BusinessProcessController], providers: [BusinessProcessService] })
export class BusinessProcessModule {}
