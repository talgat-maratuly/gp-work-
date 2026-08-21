import { DataSource } from 'typeorm';
import { SectionCodeCounter } from '../entities/section-code-counter.entity';

export async function nextSectionCode(dataSource: DataSource): Promise<string> {
  return dataSource.transaction(async (manager) => {
    const repo = manager.getRepository(SectionCodeCounter);
    let counter = await repo.findOne({ where: { id: 1 } });
    if (!counter) {
      counter = repo.create({ id: 1, value: 1 });
    } else {
      counter.value += 1;
    }
    await repo.save(counter);
    return `PIT-${String(counter.value).padStart(3, '0')}`;
  });
}
