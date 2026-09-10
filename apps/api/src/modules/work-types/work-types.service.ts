import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, QueryFailedError, Repository } from 'typeorm';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { Task } from '../../entities/task.entity';
import { WorkType } from '../../entities/work-type.entity';
import { CreateWorkTypeDto } from './dto/create-work-type.dto';
import { UpdateWorkTypeDto } from './dto/update-work-type.dto';

@Injectable()
export class WorkTypesService {
  constructor(
    @InjectRepository(WorkType)
    private readonly workTypeRepo: Repository<WorkType>,
    private readonly dataSource: DataSource,
  ) {}

  private readonly terminalTaskStatuses = [
    TaskStatus.COMPLETED,
    TaskStatus.VERIFIED,
    TaskStatus.CANCELLED,
  ];

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof QueryFailedError &&
      (error as { driverError?: { code?: string } }).driverError?.code === '23505';
  }

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
    try {
      return await this.workTypeRepo.save(row);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Такой вид работы уже есть');
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateWorkTypeDto) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(WorkType);
        const row = await repo.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!row) throw new NotFoundException('Вид работы не найден');

        if (dto.name !== undefined) {
          const name = dto.name.trim();
          if (!name) throw new BadRequestException('Название не может быть пустым');
          if (await this.hasDuplicateName(name, id)) {
            throw new ConflictException('Такой вид работы уже есть');
          }
          row.name = name;
          row.isOther = name.toLowerCase() === 'другое';
        }
        if (dto.isActive === false && row.isActive) {
          const activeTasks = await manager.getRepository(Task).count({
            where: {
              workTypeId: id,
              status: Not(In(this.terminalTaskStatuses)),
            },
          });
          if (activeTasks > 0) {
            throw new BadRequestException(
              'Сначала завершите или отмените активные задачи этого вида работы',
            );
          }
        }
        if (dto.isActive !== undefined) row.isActive = dto.isActive;
        return repo.save(row);
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Такой вид работы уже есть');
      }
      throw error;
    }
  }

  async remove(id: number) {
    return this.update(id, { isActive: false });
  }
}
