import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
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
    const members = await this.userRepo.find({
      where: { brigadeId: brigade.id },
      order: { fullName: 'ASC' },
    });
    return {
      id: brigade.id,
      name: brigade.name,
      brigadierId: brigade.brigadierId,
      description: brigade.description,
      isActive: brigade.isActive,
      createdAt: brigade.createdAt,
      updatedAt: brigade.updatedAt,
      workerIds: members.map((member) => member.id),
      workers: members.map((member) => ({
        id: member.id,
        fullName: member.fullName,
        username: member.username,
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

  private async validateMembers(workerIds: number[], brigadierId: number | null, brigadeId?: number) {
    const memberIds = [...new Set([...workerIds, ...(brigadierId == null ? [] : [brigadierId])])];
    if (!memberIds.length) return memberIds;
    const users = await this.userRepo.find({ where: { id: In(memberIds) } });
    if (users.length !== memberIds.length) throw new BadRequestException('Один из участников бригады не найден');
    const fieldRoles = [UserRole.WORKER, UserRole.WATER_CARRIER, UserRole.BRIGADIER, UserRole.AGRONOMIST];
    if (users.some((user) => !user.isActive || !fieldRoles.includes(user.role))) {
      throw new BadRequestException('В бригаду можно добавить только активного сотрудника полевой роли');
    }
    if (brigadierId != null && users.find((user) => user.id === brigadierId)?.role !== UserRole.BRIGADIER) {
      throw new BadRequestException('Бригадир должен иметь роль BRIGADIER');
    }
    const otherLeadership = await this.brigadeRepo.find({ where: { brigadierId: In(memberIds) } });
    if (otherLeadership.some((brigade) => brigade.id !== brigadeId)) {
      throw new BadRequestException('Бригадир другой бригады не может быть переведён как обычный участник');
    }
    return memberIds;
  }

  private async syncMembers(manager: EntityManager, brigadeId: number, memberIds: number[]) {
    const users = manager.getRepository(User);
    const memberships = manager.getRepository(BrigadeMember);
    await users.update({ brigadeId }, { brigadeId: null });
    await memberships.delete({ brigadeId });
    if (!memberIds.length) return;
    await memberships.delete({ userId: In(memberIds) });
    await users.update({ id: In(memberIds) }, { brigadeId });
    await memberships.save(memberIds.map((userId) => memberships.create({ brigadeId, userId })));
  }

  async create(dto: CreateBrigadeDto) {
    const brigadierId = dto.brigadierId ?? null;
    const memberIds = await this.validateMembers(dto.workerIds ?? [], brigadierId);
    const saved = await this.brigadeRepo.manager.transaction(async (manager) => {
      const brigades = manager.getRepository(Brigade);
      const row = brigades.create({
        name: dto.name,
        brigadierId,
        description: dto.description?.trim() || null,
        isActive: dto.isActive ?? true,
      });
      const brigade = await brigades.save(row);
      await this.syncMembers(manager, brigade.id, memberIds);
      return brigade;
    });
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateBrigadeDto) {
    const row = await this.brigadeRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Бригада не найдена');

    const currentMembers = await this.userRepo.find({ where: { brigadeId: id } });
    const brigadierId = dto.brigadierId !== undefined ? dto.brigadierId : row.brigadierId;
    const requestedMembers = dto.workerIds ?? currentMembers.map((member) => member.id);
    const memberIds = await this.validateMembers(requestedMembers, brigadierId, id);
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.brigadierId !== undefined) row.brigadierId = dto.brigadierId;
    if (dto.description !== undefined) row.description = dto.description?.trim() || null;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    await this.brigadeRepo.manager.transaction(async (manager) => {
      await manager.getRepository(Brigade).save(row);
      if (dto.workerIds !== undefined || dto.brigadierId !== undefined) {
        await this.syncMembers(manager, id, memberIds);
      }
    });

    return this.findOne(id);
  }

  async remove(id: number) {
    const row = await this.brigadeRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Бригада не найдена');
    row.isActive = false;
    await this.brigadeRepo.save(row);
  }
}
