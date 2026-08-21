import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAgronomAnalysis } from '../../entities/ai-agronom-analysis.entity';
import { AttendanceRecord } from '../../entities/attendance-record.entity';
import { Brigade } from '../../entities/brigade.entity';
import { NurseryObject } from '../../entities/nursery-object.entity';
import { Product } from '../../entities/product.entity';
import { Section } from '../../entities/section.entity';
import { Task } from '../../entities/task.entity';
import { User } from '../../entities/user.entity';
import { WorkLog } from '../../entities/work-log.entity';
import { AdminAiController } from './admin-ai.controller';
import { AdminAiService } from './admin-ai.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkLog,
      AttendanceRecord,
      Task,
      Product,
      User,
      Brigade,
      NurseryObject,
      Section,
      AiAgronomAnalysis,
    ]),
  ],
  controllers: [AdminAiController],
  providers: [AdminAiService],
})
export class AdminAiModule {}
