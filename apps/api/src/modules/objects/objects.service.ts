import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NurseryObject } from '../../entities/nursery-object.entity';
import { Section } from '../../entities/section.entity';
import { Task } from '../../entities/task.entity';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { CreateObjectDto } from './dto/create-object.dto';
import { UpdateObjectDto } from './dto/update-object.dto';

@Injectable()
export class ObjectsService {
  constructor(
    @InjectRepository(NurseryObject)
    private readonly objectRepo: Repository<NurseryObject>,
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
  ) {}

  private async archive(row: NurseryObject) {
    await this.objectRepo.manager.transaction(async (manager) => {
      const activeTasks = await manager.getRepository(Task)
        .createQueryBuilder('task')
        .innerJoin('task.section', 'section')
        .where('section.object_id = :objectId', { objectId: row.id })
        .andWhere('task.status NOT IN (:...closed)', {
          closed: [TaskStatus.COMPLETED, TaskStatus.VERIFIED, TaskStatus.CANCELLED],
        })
        .getCount();
      if (activeTasks) {
        throw new BadRequestException('Сначала завершите или отмените активные задачи объекта');
      }
      row.isActive = false;
      await manager.getRepository(NurseryObject).save(row);
      await manager.getRepository(Section).update({ objectId: row.id }, { isActive: false });
    });
    return this.findOne(row.id);
  }

  findAll() {
    return this.objectRepo.find({
      relations: { sections: true },
      order: { name: 'ASC', sections: { code: 'ASC' } },
    });
  }

  async findOne(id: number) {
    const row = await this.objectRepo.findOne({
      where: { id },
      relations: { sections: true },
    });
    if (!row) throw new NotFoundException('Объект не найден');
    row.sections.sort((a, b) => a.code.localeCompare(b.code));
    return row;
  }

  create(dto: CreateObjectDto) {
    const row = this.objectRepo.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      isActive: dto.isActive ?? true,
    });
    return this.objectRepo.save(row);
  }

  async update(id: number, dto: UpdateObjectDto) {
    const row = await this.findOne(id);
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.description !== undefined) row.description = dto.description?.trim() || null;
    if (dto.isActive === false) {
      return this.archive(row);
    }
    if (dto.isActive === true) row.isActive = true;
    return this.objectRepo.save(row);
  }

  async remove(id: number) {
    const row = await this.findOne(id);
    return this.archive(row);
  }
}
