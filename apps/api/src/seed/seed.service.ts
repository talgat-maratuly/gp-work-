import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SectionCodeCounter } from '../entities/section-code-counter.entity';
import { WorkType } from '../entities/work-type.entity';
import { DEFAULT_WORK_TYPES } from './seed.constants';
import { SeedResultDto } from './dto/seed-result.dto';

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(WorkType)
    private readonly workTypeRepo: Repository<WorkType>,
    @InjectRepository(SectionCodeCounter)
    private readonly counterRepo: Repository<SectionCodeCounter>,
  ) {}

  async run(): Promise<SeedResultDto> {
    let workTypesCreated = 0;
    let workTypesSkipped = 0;

    for (const name of DEFAULT_WORK_TYPES) {
      const existing = await this.workTypeRepo.findOne({ where: { name } });
      if (!existing) {
        await this.workTypeRepo.save(
          this.workTypeRepo.create({
            name,
            isActive: true,
            isOther: name === 'Другое',
          }),
        );
        workTypesCreated += 1;
      } else {
        workTypesSkipped += 1;
      }
    }

    let counterInitialized = false;
    const counter = await this.counterRepo.findOne({ where: { id: 1 } });
    if (!counter) {
      await this.counterRepo.save(this.counterRepo.create({ id: 1, value: 0 }));
      counterInitialized = true;
    }

    return {
      message: 'Seed completed',
      workTypesCreated,
      workTypesSkipped,
      counterInitialized,
    };
  }
}
