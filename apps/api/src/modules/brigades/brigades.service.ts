import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BrigadeMember } from '../../entities/brigade-member.entity';
import { Brigade } from '../../entities/brigade.entity';
import { User } from '../../entities/user.entity';
import { CreateBrigadeDto } from './dto/create-brigade.dto';
import { UpdateBrigadeDto } from './dto/update-brigade.dto';

@Injectable()
export class BrigadesService {
  constructor(
    @InjectRepository(Brigade)
    private readonly brigadeRepo: Repository<Brigade>,
    @InjectRepository(BrigadeMember)
    private readonly memberRepo: Repository<BrigadeMember>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private async toResponse(brigade: Brigade) {
    const members = await this.memberRepo.find({
      where: { brigadeId: brigade.id },
      relations: { user: true },
    });
    return {
      id: brigade.id,
      name: brigade.name,
      brigadierId: brigade.brigadierId,
      description: brigade.description,
      isActive: brigade.isActive,
      createdAt: brigade.createdAt,
      updatedAt: brigade.updatedAt,
      workerIds: members.map((m) => m.userId),
      workers: members.map((m) => ({
        id: m.user.id,
        fullName: m.user.fullName,
        username: m.user.username,
      })),
    };
  }

  async findAll() {
    const rows = await this.brigadeRepo.find({ order: { name: 'ASC' } });
    return Promise.all(rows.map((b) => this.toResponse(b)));
  }

  async findOne(id: number) {
    const row = await this.brigadeRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Бригада не найдена');
    return this.toResponse(row);
  }

  private async syncMembers(brigadeId: number, workerIds: number[]) {
    await this.memberRepo.delete({ brigadeId });
    if (!workerIds.length) return;

    const users = await this.userRepo.find({ where: { id: In(workerIds) } });
    const members = users.map((user) =>
      this.memberRepo.create({ brigadeId, userId: user.id }),
    );
    await this.memberRepo.save(members);

    for (const user of users) {
      user.brigadeId = brigadeId;
      await this.userRepo.save(user);
    }
  }

  async create(dto: CreateBrigadeDto) {
    const row = this.brigadeRepo.create({
      name: dto.name.trim(),
      brigadierId: dto.brigadierId ?? null,
      description: dto.description?.trim() || null,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.brigadeRepo.save(row);
    await this.syncMembers(saved.id, dto.workerIds ?? []);
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateBrigadeDto) {
    const row = await this.brigadeRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Бригада не найдена');

    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.brigadierId !== undefined) row.brigadierId = dto.brigadierId;
    if (dto.description !== undefined) row.description = dto.description?.trim() || null;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    await this.brigadeRepo.save(row);

    if (dto.workerIds !== undefined) {
      await this.syncMembers(id, dto.workerIds);
    }

    return this.findOne(id);
  }

  async remove(id: number) {
    const row = await this.brigadeRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Бригада не найдена');
    await this.brigadeRepo.remove(row);
  }
}
