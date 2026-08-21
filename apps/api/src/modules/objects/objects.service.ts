import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NurseryObject } from '../../entities/nursery-object.entity';
import { CreateObjectDto } from './dto/create-object.dto';
import { UpdateObjectDto } from './dto/update-object.dto';

@Injectable()
export class ObjectsService {
  constructor(
    @InjectRepository(NurseryObject)
    private readonly objectRepo: Repository<NurseryObject>,
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
    });
    return this.objectRepo.save(row);
  }

  async update(id: number, dto: UpdateObjectDto) {
    const row = await this.findOne(id);
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.description !== undefined) row.description = dto.description?.trim() || null;
    return this.objectRepo.save(row);
  }

  async remove(id: number) {
    const row = await this.findOne(id);
    return this.objectRepo.remove(row);
  }
}
