import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NurseryObject } from '../../entities/nursery-object.entity';
import { Section } from '../../entities/section.entity';
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
      await this.objectRepo.manager.transaction(async (manager) => {
        await manager.getRepository(NurseryObject).save({ ...row, isActive: false });
        await manager.getRepository(Section).update({ objectId: id }, { isActive: false });
      });
      return this.findOne(id);
    }
    if (dto.isActive === true) row.isActive = true;
    return this.objectRepo.save(row);
  }

  async remove(id: number) {
    const row = await this.findOne(id);
    await this.objectRepo.manager.transaction(async (manager) => {
      await manager.getRepository(NurseryObject).update(id, { isActive: false });
      await manager.getRepository(Section).update({ objectId: id }, { isActive: false });
    });
    return this.findOne(id);
  }
}
