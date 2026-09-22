import { BadRequestException } from '@nestjs/common';

export function assertNewPassword(password: string): void {
  if (typeof password !== 'string' || password.length < 8 || !/\S/.test(password)) {
    throw new BadRequestException('Пароль должен содержать минимум 8 символов и не состоять из пробелов.');
  }
  // bcrypt truncates inputs after 72 bytes, including multi-byte Cyrillic.
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new BadRequestException('Пароль слишком длинный: максимум 72 латинских или 36 кириллических символов.');
  }
}
