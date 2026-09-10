import { ConfigService } from '@nestjs/config';
import { getJwtSecret } from './auth.config';

describe('getJwtSecret', () => {
  it('rejects a short production signing secret', () => {
    const config = new ConfigService({ NODE_ENV: 'production', JWT_SECRET: 'too-short' });
    expect(() => getJwtSecret(config)).toThrow('минимум 32 байта');
  });

  it('accepts a 32-byte production signing secret', () => {
    const secret = '12345678901234567890123456789012';
    const config = new ConfigService({ NODE_ENV: 'production', JWT_SECRET: secret });
    expect(getJwtSecret(config)).toBe(secret);
  });
});
