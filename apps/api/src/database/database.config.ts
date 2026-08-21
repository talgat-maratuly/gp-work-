import { ConfigService } from '@nestjs/config';

export interface DatabaseEnv {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export function getDatabaseEnv(env: NodeJS.ProcessEnv = process.env): DatabaseEnv {
  return {
    host: env.DATABASE_HOST ?? 'localhost',
    port: Number(env.DATABASE_PORT ?? 5432),
    username: env.DATABASE_USERNAME ?? 'postgres',
    password: env.DATABASE_PASSWORD ?? 'postgres',
    database: env.DATABASE_NAME ?? 'gp-work',
  };
}

export function getTypeOrmPostgresOptions(env: NodeJS.ProcessEnv = process.env) {
  const db = getDatabaseEnv(env);
  return {
    type: 'postgres' as const,
    host: db.host,
    port: db.port,
    username: db.username,
    password: db.password,
    database: db.database,
  };
}

export function getTypeOrmPostgresFromConfig(config: ConfigService) {
  return {
    type: 'postgres' as const,
    host: config.get<string>('DATABASE_HOST', 'localhost'),
    port: config.get<number>('DATABASE_PORT', 5432),
    username: config.get<string>('DATABASE_USERNAME', 'postgres'),
    password: config.get<string>('DATABASE_PASSWORD', 'postgres'),
    database: config.get<string>('DATABASE_NAME', 'gp-work'),
  };
}
