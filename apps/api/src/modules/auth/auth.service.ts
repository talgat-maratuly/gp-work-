import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../entities/user.entity';
import { LoginDto } from './dto/login.dto';

export type JwtPayload = { sub: number; role: string };

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { username: username.trim() } });
    if (!user) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }
    if (!user.isActive) {
      throw new ForbiddenException('Пользователь заблокирован');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }
    const ok = await bcrypt.compare(password, user.passwordHash).catch(() => false);
    if (!ok) throw new UnauthorizedException('Неверный логин или пароль');
    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.username, dto.password);
    const payload: JwtPayload = { sub: user.id, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: this.toPublicUser(user),
      role: user.role,
    };
  }

  async resetAdmin() {
    const passwordHash = await bcrypt.hash('admin123', 10);
    let admin = await this.userRepo.findOne({ where: { username: 'admin' } });

    if (!admin) {
      admin = this.userRepo.create({
        fullName: 'Администратор',
        username: 'admin',
      });
    }

    admin.passwordHash = passwordHash;
    admin.role = UserRole.ADMIN;
    admin.isActive = true;
    admin.fullName = admin.fullName || 'Администратор';

    const saved = await this.userRepo.save(admin);
    return {
      message: 'Администратор восстановлен',
      user: this.toPublicUser(saved),
      role: saved.role,
    };
  }

  async findById(id: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id, isActive: true } });
  }

  toPublicUser(user: User) {
    return {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      role: user.role,
      brigadeId: user.brigadeId,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
