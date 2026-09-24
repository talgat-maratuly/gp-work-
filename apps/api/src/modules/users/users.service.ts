import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { In, IsNull, Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { Brigade } from '../../entities/brigade.entity';
import { BrigadeMember } from '../../entities/brigade-member.entity';
import { User } from '../../entities/user.entity';
import { JobPosition } from '../../entities/job-position.entity';
import { AuthService } from '../auth/auth.service';
import { assertNewPassword } from '../auth/password-policy';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { lockBrigadeMembership } from '../../common/brigade-membership';
import { resolveAccessRole } from '../access-roles/access-roles.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Brigade)
    private readonly brigadeRepo: Repository<Brigade>,
    private readonly authService: AuthService,
  ) {}

  private saveWithMembership(row: User, validatePosition = false) {
    return this.userRepo.manager.transaction(async (manager) => {
      await lockBrigadeMembership(manager);
      const policy = await resolveAccessRole(manager, row);
      if (!policy?.isActive || policy.baseRole !== row.role || (row.accessRoleId != null && policy.systemKey)) {
        throw new BadRequestException('Выберите действующую роль доступа');
      }
      row.accessPolicy = policy;
      if (row.brigadeId != null && !policy.canJoinBrigade) throw new BadRequestException('Для этой роли привязка к бригаде запрещена');
      const existing = row.id ? await manager.getRepository(User).findOneBy({ id: row.id }) : null;
      if (existing?.isActive && existing.accessRoleId == null && this.isPrivileged(existing.role) &&
        (!row.isActive || row.accessRoleId != null || !this.isPrivileged(row.role))) {
        const privileged = await manager.getRepository(User).count({where:{isActive:true,accessRoleId:IsNull(),role:In([UserRole.ADMIN,UserRole.DIRECTOR])}});
        if (privileged <= 1) throw new BadRequestException('Нельзя отключить или понизить последнего администратора');
      }
      const sameAssignment = existing?.brigadeId === row.brigadeId && existing?.role === row.role &&
        (existing?.accessRoleId ?? null) === (row.accessRoleId ?? null);
      const brigades = manager.getRepository(Brigade);
      const brigade = row.brigadeId == null ? null : await brigades.findOneBy({ id: row.brigadeId });
      if (row.brigadeId != null && (!brigade || (!brigade.isActive && !sameAssignment))) {
        throw new BadRequestException('Выберите действующую бригаду. Она не найдена или деактивирована.');
      }
      if (row.role === UserRole.BRIGADIER && brigade?.brigadierId != null && brigade.brigadierId !== row.id && !sameAssignment) {
        throw new ConflictException('У этой бригады уже есть бригадир. Выберите свободную бригаду или сначала измените её руководителя.');
      }
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
      // Moving/unassigning a leader or changing their role must release the old
      // leadership link as well as the ordinary membership link.
      await brigades.createQueryBuilder().update().set({ brigadierId: null })
        .where('brigadier_id = :userId', { userId: saved.id })
        .andWhere('id != :keepId', { keepId: saved.role === UserRole.BRIGADIER ? saved.brigadeId ?? -1 : -1 }).execute();
      if (brigade && saved.role === UserRole.BRIGADIER && (brigade.brigadierId == null || brigade.brigadierId === saved.id)) {
        await brigades.update(brigade.id, { brigadierId: saved.id });
      }
      const memberships = manager.getRepository(BrigadeMember);
      await memberships.delete({ userId: saved.id });
      if (saved.brigadeId != null) {
        await memberships.save(memberships.create({ brigadeId: saved.brigadeId, userId: saved.id }));
      }
      return saved;
    });
  }

  async findAll() {
    const rows = await this.userRepo.createQueryBuilder('user').addSelect('user.mustChangePassword')
      .leftJoinAndSelect('user.position', 'position').orderBy('user.fullName', 'ASC').getMany();
    return Promise.all(rows.map(async row => { row.accessPolicy = await resolveAccessRole(this.userRepo.manager,row) ?? undefined; return row; }));
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

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const row = this.userRepo.create({
      fullName: dto.fullName.trim(),
      username: dto.username.trim(),
      passwordHash,
      role: dto.role,
      accessRoleId: dto.accessRoleId ?? null,
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
    if (!row.isActive || row.accessRoleId != null || !this.isPrivileged(row.role) || (nextActive && this.isPrivileged(nextRole))) return;
    const activePrivileged = await this.userRepo.count({
      where: { isActive: true, accessRoleId: IsNull(), role: In([UserRole.ADMIN, UserRole.DIRECTOR]) },
    });
    if (activePrivileged <= 1) {
      throw new BadRequestException('Нельзя отключить или понизить последнего администратора');
    }
  }

  async update(id: number, dto: UpdateUserDto, actor: User) {
    const row = await this.findOne(id);
    const positionChanged = dto.positionId !== undefined && dto.positionId !== row.positionId;

    if (actor.id === row.id && dto.isActive === false) {
      throw new BadRequestException('Нельзя заблокировать собственную учётную запись');
    }
    if (actor.id === row.id && dto.role !== undefined && dto.role !== row.role) {
      throw new BadRequestException('Нельзя изменить собственную роль');
    }
    if (actor.id === row.id && dto.accessRoleId !== undefined && dto.accessRoleId !== row.accessRoleId) {
      throw new BadRequestException('Нельзя изменить собственную роль');
    }
    await this.assertPrivilegedAccountRemains(
      row,
      dto.accessRoleId != null ? UserRole.WORKER : dto.role ?? row.role,
      dto.isActive ?? row.isActive,
    );

    if (dto.username && dto.username.trim() !== row.username) {
      const existing = await this.userRepo.findOne({ where: { username: dto.username.trim() } });
      if (existing) throw new ConflictException('Пользователь с таким логином уже существует');
      row.username = dto.username.trim();
    }
    if (dto.fullName !== undefined) row.fullName = dto.fullName.trim();
    if (dto.role !== undefined && dto.role !== row.role && dto.accessRoleId === undefined) row.accessRoleId = null;
    if (dto.role !== undefined) row.role = dto.role;
    if (dto.accessRoleId !== undefined) row.accessRoleId = dto.accessRoleId;
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
    await this.saveWithMembership(row);
  }

  async findOnePublic(id: number) {
    const row = await this.userRepo.createQueryBuilder('user').addSelect('user.mustChangePassword')
      .leftJoinAndSelect('user.position', 'position').where('user.id = :id', { id }).getOne();
    if (!row) throw new NotFoundException('Пользователь не найден');
    row.accessPolicy = await resolveAccessRole(this.userRepo.manager, row) ?? undefined;
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
