import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

const candidates = [
  join(process.cwd(), 'apps/api/.env'),
  join(process.cwd(), '.env'),
  join(__dirname, '..', '..', '.env'),
  join(__dirname, '..', '..', '..', '.env'),
];

export function loadEnvFiles(): void {
  for (const path of candidates) {
    if (existsSync(path)) {
      config({ path });
    }
  }
}
