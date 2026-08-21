import { Module } from '@nestjs/common';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { WorkLogsModule } from '../work-logs/work-logs.module';

@Module({
  imports: [WorkLogsModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
