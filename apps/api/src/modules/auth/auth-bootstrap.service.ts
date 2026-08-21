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
    const password = process.env.ADMIN_PASSWORD ?? 'admin123';

    let admin =
      (await this.userRepo.findOne({ where: { username } })) ??
      (await this.userRepo.findOne({ where: { role: UserRole.ADMIN } }));

    if (!admin) {
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
      return;
    }

    if (!process.env.ADMIN_PASSWORD) return;

    admin.username = username;
    admin.passwordHash = await bcrypt.hash(password, 10);
    admin.role = UserRole.ADMIN;
    admin.isActive = true;
    await this.userRepo.save(admin);
    console.log(`[auth] Пароль администратора синхронизирован из ADMIN_PASSWORD (логин "${username}")`);
  }
}
