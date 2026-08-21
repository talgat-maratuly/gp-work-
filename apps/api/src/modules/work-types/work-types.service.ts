import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkType } from '../../entities/work-type.entity';
import { CreateWorkTypeDto } from './dto/create-work-type.dto';
import { UpdateWorkTypeDto } from './dto/update-work-type.dto';

@Injectable()
export class WorkTypesService {
  constructor(
    @InjectRepository(WorkType)
    private readonly workTypeRepo: Repository<WorkType>,
  ) {}

  findAll() {
    return this.workTypeRepo.find({ order: { name: 'ASC' } });
  }

  findActive() {
    return this.workTypeRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number) {
    const row = await this.workTypeRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Вид работы не найден');
    return row;
  }

  private async hasDuplicateName(name: string, excludeId?: number): Promise<boolean> {
    const normalized = name.trim().toLowerCase();
    const qb = this.workTypeRepo.createQueryBuilder('wt');
    if (excludeId) qb.where('wt.id != :excludeId', { excludeId });
    const all = await qb.getMany();
    return all.some((t) => t.name.trim().toLowerCase() === normalized);
  }

  async create(dto: CreateWorkTypeDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Название не может быть пустым');

    if (await this.hasDuplicateName(name)) {
      throw new ConflictException('Такой вид работы уже есть');
    }

    const row = this.workTypeRepo.create({
      name,
      isActive: true,
      isOther: name.toLowerCase() === 'другое',
    });
    return this.workTypeRepo.save(row);
  }

  async update(id: number, dto: UpdateWorkTypeDto) {
    const row = await this.findOne(id);

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Название не может быть пустым');
      if (await this.hasDuplicateName(name, id)) {
        throw new ConflictException('Такой вид работы уже есть');
      }
      row.name = name;
      row.isOther = name.toLowerCase() === 'другое';
    }
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    return this.workTypeRepo.save(row);
  }

  async remove(id: number) {
    const row = await this.findOne(id);
    return this.workTypeRepo.remove(row);
  }
}
