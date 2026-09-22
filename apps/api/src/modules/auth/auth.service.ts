import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { assertNewPassword } from './password-policy';

export type JwtPayload = { sub: number; role: string; ver?: number };

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<User> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect(['user.passwordHash', 'user.authVersion', 'user.mustChangePassword', 'user.passwordResetExpiresAt'])
      .leftJoinAndSelect('user.position', 'position')
      .where('user.username = :username', { username: username.trim() })
      .getOne();
    if (!user) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }
    const ok = await bcrypt.compare(password, user.passwordHash).catch(() => false);
    if (!ok) throw new UnauthorizedException('Неверный логин или пароль');
    if (user.mustChangePassword && (!user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() <= Date.now())) {
      throw new UnauthorizedException('Временный пароль истёк. Обратитесь к администратору за новым.');
    }
    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.username, dto.password);
    const payload: JwtPayload = { sub: user.id, role: user.role, ver: user.authVersion };
    return {
      accessToken: this.jwtService.sign(payload, user.mustChangePassword ? { expiresIn: '15m' } : {}),
      user: this.toPublicUser(user),
      role: user.role,
    };
  }

  async resetAdmin(resetToken?: string) {
    const expected = process.env.ADMIN_RESET_TOKEN?.trim();
    if (process.env.ENABLE_ADMIN_RESET !== 'true' || !expected || !resetToken) {
      throw new NotFoundException('Endpoint недоступен');
    }
    const supplied = Buffer.from(resetToken);
    const reference = Buffer.from(expected);
    if (supplied.length !== reference.length || !timingSafeEqual(supplied, reference)) {
      throw new ForbiddenException('Неверный токен восстановления');
    }
    const password = process.env.ADMIN_PASSWORD?.trim();
    if (!password) throw new ForbiddenException('ADMIN_PASSWORD не настроен');
    assertNewPassword(password);
    const passwordHash = await bcrypt.hash(password, 10);
    const username = (process.env.ADMIN_USERNAME ?? 'admin').trim();
    const saved = await this.userRepo.manager.transaction(async manager => {
      const repo = manager.getRepository(User);
      let admin = await repo.createQueryBuilder('user').addSelect('user.authVersion')
        .where('user.username = :username', { username }).setLock('pessimistic_write').getOne();
      if (!admin) admin = repo.create({ fullName: 'Администратор', username, authVersion: 0 });
      admin.passwordHash = passwordHash;
      admin.authVersion += 1;
      admin.mustChangePassword = false;
      admin.passwordResetExpiresAt = null;
      admin.role = UserRole.ADMIN;
      admin.isActive = true;
      admin.fullName = admin.fullName || 'Администратор';
      return repo.save(admin);
    });
    return {
      message: 'Администратор восстановлен',
      user: this.toPublicUser(saved),
      role: saved.role,
    };
  }

  async findById(id: number): Promise<User | null> {
    return this.userRepo.createQueryBuilder('user')
      .addSelect(['user.authVersion', 'user.mustChangePassword', 'user.passwordResetExpiresAt'])
      .leftJoinAndSelect('user.position', 'position')
      .where('user.id = :id AND user.isActive = true', { id }).getOne();
  }

  async resetUserPassword(id: number, actor: User, suppliedPassword?: string) {
    if (id === actor.id) throw new BadRequestException('Для своего аккаунта используйте «Сменить пароль».');
    // 80 random bits, no ambiguous I/O/0/1. The plaintext is returned once and
    // never persisted. An explicit repeat reset invalidates the previous one.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const password = suppliedPassword ?? Array.from(randomBytes(16), byte => alphabet[byte % alphabet.length]).join('');
    assertNewPassword(password);
    const passwordHash = await bcrypt.hash(password, 10);
    return this.userRepo.manager.transaction(async manager => {
      const repo = manager.getRepository(User);
      const user = await repo.createQueryBuilder('user').addSelect('user.authVersion')
        .where('user.id = :id', { id }).setLock('pessimistic_write').getOne();
      if (!user) throw new NotFoundException('Пользователь не найден');
      if (!user.isActive) throw new BadRequestException('Сначала разблокируйте пользователя.');
      const currentActor = await repo.createQueryBuilder('user').addSelect(['user.authVersion', 'user.mustChangePassword'])
        .where('user.id = :id', { id: actor.id }).getOne();
      if (!currentActor?.isActive || currentActor.authVersion !== actor.authVersion || currentActor.mustChangePassword) {
        throw new UnauthorizedException('Сессия истекла. Войдите заново.');
      }
      if (![UserRole.ADMIN, UserRole.DIRECTOR].includes(currentActor.role)) throw new ForbiddenException();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await repo.update(id, {
        passwordHash, authVersion: user.authVersion + 1, mustChangePassword: true,
        passwordResetAt: new Date(), passwordResetExpiresAt: expiresAt, passwordResetById: actor.id,
      });
      return { userId: user.id, username: user.username, fullName: user.fullName, temporaryPassword: password, expiresAt: expiresAt.toISOString() };
    });
  }

  async changeOwnPassword(actor: User, dto: ChangePasswordDto) {
    assertNewPassword(dto.newPassword);
    await this.userRepo.manager.transaction(async manager => {
      const repo = manager.getRepository(User);
      const user = await repo.createQueryBuilder('user')
        .addSelect(['user.passwordHash', 'user.authVersion', 'user.mustChangePassword', 'user.passwordResetExpiresAt'])
        .where('user.id = :id', { id: actor.id }).setLock('pessimistic_write').getOne();
      if (!user?.isActive || !user.passwordHash || user.authVersion !== actor.authVersion) {
        throw new UnauthorizedException('Сессия истекла. Войдите заново.');
      }
      if (user.mustChangePassword) {
        if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() <= Date.now()) {
          throw new UnauthorizedException('Временный пароль истёк. Обратитесь к администратору за новым.');
        }
      } else if (!dto.currentPassword || !await bcrypt.compare(dto.currentPassword, user.passwordHash)) {
        throw new BadRequestException('Текущий пароль указан неверно.');
      }
      if (await bcrypt.compare(dto.newPassword, user.passwordHash)) {
        throw new BadRequestException('Новый пароль должен отличаться от текущего.');
      }
      await repo.update(user.id, {
        passwordHash: await bcrypt.hash(dto.newPassword, 10),
        authVersion: user.authVersion + 1, mustChangePassword: false, passwordResetExpiresAt: null,
      });
    });
  }

  toPublicUser(user: User) {
    return {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      role: user.role,
      positionId: user.positionId ?? null,
      positionName: user.position?.name ?? null,
      brigadeId: user.brigadeId,
      isActive: user.isActive,
      mustChangePassword: Boolean(user.mustChangePassword),
      createdAt: user.createdAt,
    };
  }
}
