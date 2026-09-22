import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { In, Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { Brigade } from '../../entities/brigade.entity';
import { BrigadeMember } from '../../entities/brigade-member.entity';
import { User } from '../../entities/user.entity';
import { JobPosition } from '../../entities/job-position.entity';
import { AuthService } from '../auth/auth.service';
import { assertNewPassword } from '../auth/password-policy';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Brigade)
    private readonly brigadeRepo: Repository<Brigade>,
    private readonly authService: AuthService,
  ) {}

  private async assertActiveBrigade(brigadeId: number | null | undefined) {
    if (brigadeId == null) return;
    const brigade = await this.brigadeRepo.findOne({ where: { id: brigadeId, isActive: true } });
    if (!brigade) throw new BadRequestException('Активная бригада не найдена');
  }

  private assertFieldMembership(role: UserRole, brigadeId: number | null | undefined) {
    if (brigadeId == null) return;
    if (![UserRole.WORKER, UserRole.WATER_CARRIER, UserRole.BRIGADIER, UserRole.AGRONOMIST].includes(role)) {
      throw new BadRequestException('К бригаде можно привязать только сотрудника полевой роли');
    }
  }

  private saveWithMembership(row: User, validatePosition = false) {
    return this.userRepo.manager.transaction(async (manager) => {
      if (validatePosition) {
        row.position = row.positionId == null ? null : await manager.getRepository(JobPosition).findOne({
          where: { id: row.positionId, isActive: true },
          lock: { mode: 'pessimistic_read' },
        });
        if (row.positionId != null && !row.position) {
          throw new BadRequestException('Выберите действующую должность. Она не найдена или перенесена в архив.');
        }
      }
      const saved = await manager.getRepository(User).save(row);
      const memberships = manager.getRepository(BrigadeMember);
      await memberships.delete({ userId: saved.id });
      if (saved.brigadeId != null) {
        await memberships.save(memberships.create({ brigadeId: saved.brigadeId, userId: saved.id }));
      }
      return saved;
    });
  }

  findAll() {
    return this.userRepo.createQueryBuilder('user').addSelect('user.mustChangePassword')
      .leftJoinAndSelect('user.position', 'position').orderBy('user.fullName', 'ASC').getMany();
  }

  findActiveAssignees(actor?: User) {
    return this.userRepo.find({
      where: {
        isActive: true,
        role: In([UserRole.WORKER, UserRole.WATER_CARRIER, UserRole.BRIGADIER, UserRole.AGRONOMIST]),
        ...(actor?.role === UserRole.BRIGADIER ? { brigadeId: actor.brigadeId ?? -1 } : {}),
      },
      order: { fullName: 'ASC' },
    });
  }

  async findOne(id: number) {
    const row = await this.userRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Пользователь не найден');
    return row;
  }

  async create(dto: CreateUserDto) {
    assertNewPassword(dto.password);
    const existing = await this.userRepo.findOne({ where: { username: dto.username.trim() } });
    if (existing) throw new ConflictException('Пользователь с таким логином уже существует');

    await this.assertActiveBrigade(dto.brigadeId);
    this.assertFieldMembership(dto.role, dto.brigadeId);
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const row = this.userRepo.create({
      fullName: dto.fullName.trim(),
      username: dto.username.trim(),
      passwordHash,
      role: dto.role,
      positionId: dto.positionId ?? null,
      brigadeId: dto.brigadeId ?? null,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.saveWithMembership(row, true);
    return this.authService.toPublicUser(saved);
  }

  private isPrivileged(role: UserRole) {
    return [UserRole.ADMIN, UserRole.DIRECTOR].includes(role);
  }

  private async assertPrivilegedAccountRemains(row: User, nextRole: UserRole, nextActive: boolean) {
    if (!row.isActive || !this.isPrivileged(row.role) || (nextActive && this.isPrivileged(nextRole))) return;
    const activePrivileged = await this.userRepo.count({
      where: { isActive: true, role: In([UserRole.ADMIN, UserRole.DIRECTOR]) },
    });
    if (activePrivileged <= 1) {
      throw new BadRequestException('Нельзя отключить или понизить последнего администратора');
    }
  }

  async update(id: number, dto: UpdateUserDto, actor: User) {
    const row = await this.findOne(id);
    const positionChanged = dto.positionId !== undefined && dto.positionId !== row.positionId;
    if (dto.brigadeId !== undefined && dto.brigadeId !== row.brigadeId) {
      await this.assertActiveBrigade(dto.brigadeId);
    }
    this.assertFieldMembership(dto.role ?? row.role, dto.brigadeId !== undefined ? dto.brigadeId : row.brigadeId);

    if (actor.id === row.id && dto.isActive === false) {
      throw new BadRequestException('Нельзя заблокировать собственную учётную запись');
    }
    if (actor.id === row.id && dto.role !== undefined && dto.role !== row.role) {
      throw new BadRequestException('Нельзя изменить собственную роль');
    }
    await this.assertPrivilegedAccountRemains(
      row,
      dto.role ?? row.role,
      dto.isActive ?? row.isActive,
    );

    if (dto.username && dto.username.trim() !== row.username) {
      const existing = await this.userRepo.findOne({ where: { username: dto.username.trim() } });
      if (existing) throw new ConflictException('Пользователь с таким логином уже существует');
      row.username = dto.username.trim();
    }
    if (dto.fullName !== undefined) row.fullName = dto.fullName.trim();
    if (dto.role !== undefined) row.role = dto.role;
    if (dto.positionId !== undefined) row.positionId = dto.positionId;
    if (dto.brigadeId !== undefined) row.brigadeId = dto.brigadeId;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    await this.saveWithMembership(row, positionChanged);
    return this.findOnePublic(id);
  }

  async changePassword(id: number, password: string, actor: User) {
    await this.authService.resetUserPassword(id, actor, password);
    return this.findOnePublic(id);
  }

  resetPassword(id: number, actor: User) {
    return this.authService.resetUserPassword(id, actor);
  }

  async deactivate(id: number, actor: User) {
    const row = await this.findOne(id);
    if (actor.id === row.id) throw new BadRequestException('Нельзя отключить собственную учётную запись');
    await this.assertPrivilegedAccountRemains(row, row.role, false);
    row.isActive = false;
    await this.userRepo.save(row);
  }

  async findOnePublic(id: number) {
    const row = await this.userRepo.createQueryBuilder('user').addSelect('user.mustChangePassword')
      .leftJoinAndSelect('user.position', 'position').where('user.id = :id', { id }).getOne();
    if (!row) throw new NotFoundException('Пользователь не найден');
    return this.authService.toPublicUser(row);
  }

  async getBrigadeWorkerNames(brigadeId: number): Promise<string[]> {
    const users = await this.userRepo.find({
      where: { brigadeId, role: UserRole.WORKER, isActive: true },
    });
    return users.map((u) => u.fullName);
  }

  async getBrigadeWorkerIds(brigadeId: number): Promise<number[]> {
    const users = await this.userRepo.find({
      select: { id: true },
      where: { brigadeId, role: UserRole.WORKER, isActive: true },
    });
    return users.map((user) => user.id);
  }
}
