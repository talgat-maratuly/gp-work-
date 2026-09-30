import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { VehicleTypeRef } from '../../entities/vehicle-type.entity';
import { CreateVehicleTypeDto } from './dto/create-vehicle-type.dto';
import { UpdateVehicleTypeDto } from './dto/update-vehicle-type.dto';

@Injectable()
export class VehicleTypesService {
  constructor(
    @InjectRepository(VehicleTypeRef)
    private readonly repo: Repository<VehicleTypeRef>,
  ) {}

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as { driverError?: { code?: string } }).driverError?.code === '23505'
    );
  }

  findAll() {
    return this.repo.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  findActive() {
    return this.repo.find({ where: { isActive: true }, order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  private async hasDuplicateName(name: string, excludeId?: number): Promise<boolean> {
    const normalized = name.trim().toLowerCase();
    const all = await this.repo.find();
    return all.some(
      (t) => t.id !== excludeId && t.name.trim().toLowerCase() === normalized,
    );
  }

  async create(dto: CreateVehicleTypeDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Название не может быть пустым');
    if (await this.hasDuplicateName(name)) {
      throw new ConflictException('Такой вид техники уже есть');
    }
    const max = await this.repo
      .createQueryBuilder('vt')
      .select('COALESCE(MAX(vt.sort_order), 0)', 'max')
      .getRawOne<{ max: string }>();
    const key = `CUSTOM_${Date.now().toString(36).toUpperCase()}`;
    const row = this.repo.create({
      key,
      name,
      sortOrder: Number(max?.max ?? 0) + 10,
      isActive: true,
      isSystem: false,
    });
    try {
      return await this.repo.save(row);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Такой вид техники уже есть');
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateVehicleTypeDto) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Вид техники не найден');

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Название не может быть пустым');
      if (await this.hasDuplicateName(name, id)) {
        throw new ConflictException('Такой вид техники уже есть');
      }
      row.name = name;
    }
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;

    try {
      return await this.repo.save(row);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Такой вид техники уже есть');
      }
      throw error;
    }
  }

  async remove(id: number) {
    // Виды техники не удаляются — переводятся в архив, чтобы старая техника и
    // история назначений сохранили свой вид.
    return this.update(id, { isActive: false });
  }

  // Используется при создании техники: проверяет, что выбран действующий вид.
  async assertActiveKey(key: string): Promise<void> {
    const row = await this.repo.findOne({ where: { key, isActive: true } });
    if (!row) throw new BadRequestException('Выберите действующий вид техники');
  }
}
