import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { JobPosition } from '../../entities/job-position.entity';
import { CreateJobPositionDto, UpdateJobPositionDto } from './dto/job-position.dto';

@Injectable()
export class JobPositionsService {
  constructor(@InjectRepository(JobPosition) private readonly positions: Repository<JobPosition>) {}

  findAll() {
    return this.positions.find({ order: { isActive: 'DESC', name: 'ASC' } });
  }

  private async save(position: JobPosition) {
    try {
      return await this.positions.save(position);
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505') {
        throw new ConflictException('Должность с таким названием уже существует. Если она в архиве, восстановите её.');
      }
      throw error;
    }
  }

  create(dto: CreateJobPositionDto) {
    return this.save(this.positions.create({ name: dto.name }));
  }

  async update(id: number, dto: UpdateJobPositionDto) {
    if (dto.name === undefined && dto.isActive === undefined) {
      throw new BadRequestException('Укажите название или статус должности');
    }
    const row = await this.positions.findOneBy({ id });
    if (!row) throw new NotFoundException('Должность не найдена');
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    return this.save(row);
  }
}
