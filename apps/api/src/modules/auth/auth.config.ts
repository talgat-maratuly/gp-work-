import { ConfigService } from '@nestjs/config';

export function getJwtSecret(config: ConfigService): string {
  const configured = config.get<string>('JWT_SECRET')?.trim();
  if (configured) return configured;
  if (config.get<string>('NODE_ENV') === 'production') {
    throw new Error('JWT_SECRET обязателен в production');
  }
  return 'gp-work-local-development-secret';
}
