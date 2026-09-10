import { ConfigService } from '@nestjs/config';

export function getJwtSecret(config: ConfigService): string {
  const configured = config.get<string>('JWT_SECRET')?.trim();
  if (config.get<string>('NODE_ENV') === 'production') {
    if (!configured || Buffer.byteLength(configured, 'utf8') < 32) {
      throw new Error('JWT_SECRET в production должен содержать минимум 32 байта');
    }
  }
  if (configured) return configured;
  return 'gp-work-local-development-secret';
}
