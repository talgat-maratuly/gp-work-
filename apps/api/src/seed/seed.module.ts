import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SectionCodeCounter } from '../entities/section-code-counter.entity';
import { WorkType } from '../entities/work-type.entity';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkType, SectionCodeCounter])],
  controllers: [SeedController],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
