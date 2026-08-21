import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../entities/user.entity';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly authService: AuthService,
  ) {}

  findAll() {
    return this.userRepo.find({ order: { fullName: 'ASC' } });
  }

  findActiveAssignees() {
    return this.userRepo
      .find({
        where: { isActive: true },
        order: { fullName: 'ASC' },
      })
      .then((rows) => rows.filter((u) => u.role !== UserRole.ADMIN));
  }

  async findOne(id: number) {
    const row = await this.userRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Пользователь не найден');
    return row;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.userRepo.findOne({ where: { username: dto.username.trim() } });
    if (existing) throw new ConflictException('Пользователь с таким логином уже существует');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const row = this.userRepo.create({
      fullName: dto.fullName.trim(),
      username: dto.username.trim(),
      passwordHash,
      role: dto.role,
      brigadeId: dto.brigadeId ?? null,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.userRepo.save(row);
    return this.authService.toPublicUser(saved);
  }

  async update(id: number, dto: UpdateUserDto) {
    const row = await this.findOne(id);

    if (dto.username && dto.username.trim() !== row.username) {
      const existing = await this.userRepo.findOne({ where: { username: dto.username.trim() } });
      if (existing) throw new ConflictException('Пользователь с таким логином уже существует');
      row.username = dto.username.trim();
    }
    if (dto.fullName !== undefined) row.fullName = dto.fullName.trim();
    if (dto.role !== undefined) row.role = dto.role;
    if (dto.brigadeId !== undefined) row.brigadeId = dto.brigadeId;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.password) row.passwordHash = await bcrypt.hash(dto.password, 10);

    const saved = await this.userRepo.save(row);
    return this.authService.toPublicUser(saved);
  }

  async changePassword(id: number, password: string) {
    const row = await this.findOne(id);
    row.passwordHash = await bcrypt.hash(password, 10);
    const saved = await this.userRepo.save(row);
    return this.authService.toPublicUser(saved);
  }

  async remove(id: number) {
    const row = await this.findOne(id);
    await this.userRepo.remove(row);
  }

  async findOnePublic(id: number) {
    const row = await this.findOne(id);
    return this.authService.toPublicUser(row);
  }

  async getBrigadeWorkerNames(brigadeId: number): Promise<string[]> {
    const users = await this.userRepo.find({
      where: { brigadeId, role: UserRole.WORKER, isActive: true },
    });
    return users.map((u) => u.fullName);
  }
}
