import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAgronomAnalysis } from '../../entities/ai-agronom-analysis.entity';
import { NurseryObject } from '../../entities/nursery-object.entity';
import { Section } from '../../entities/section.entity';
import { AiAgronomController } from './ai-agronom.controller';
import { AiAgronomService } from './ai-agronom.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiAgronomAnalysis, NurseryObject, Section])],
  controllers: [AiAgronomController],
  providers: [AiAgronomService],
})
export class AiAgronomModule {}
