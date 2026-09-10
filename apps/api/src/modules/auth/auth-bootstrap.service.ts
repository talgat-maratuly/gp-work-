import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../entities/user.entity';

@Injectable()
export class AuthBootstrapService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async onModuleInit() {
    const username = (process.env.ADMIN_USERNAME ?? 'admin').trim();
    const configuredPassword = process.env.ADMIN_PASSWORD?.trim();

    const admin =
      (await this.userRepo.findOne({ where: { username } })) ??
      (await this.userRepo.findOne({ where: { role: UserRole.ADMIN } }));

    // Bootstrap создаёт первую учётную запись только один раз. Существующего
    // администратора нельзя переименовывать, разблокировать или сбрасывать на
    // env-пароль при каждом рестарте приложения.
    if (admin) return;
    if (process.env.NODE_ENV === 'production' && !configuredPassword) {
      throw new Error('ADMIN_PASSWORD обязателен при первом production-запуске');
    }
    const password = configuredPassword || 'admin123';
    if (password.length < 8) {
      throw new Error('ADMIN_PASSWORD должен содержать минимум 8 символов');
    }
    await this.userRepo.save(
      this.userRepo.create({
        fullName: 'Администратор',
        username,
        passwordHash: await bcrypt.hash(password, 10),
        role: UserRole.ADMIN,
        isActive: true,
      }),
    );
    console.log(`[auth] Создан администратор: логин "${username}"`);
  }
}
