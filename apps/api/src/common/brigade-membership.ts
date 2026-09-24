import { EntityManager } from 'typeorm';
import { UserRole } from './enums/user-role.enum';

export const BRIGADE_MEMBER_ROLES: readonly UserRole[] = [
  UserRole.WORKER, UserRole.WATER_CARRIER, UserRole.BRIGADIER, UserRole.AGRONOMIST,
];

// Both editors write the same three existing tables. Serialize their short
// membership transactions so a concurrent assignment cannot replace a leader
// after validation or leave users.brigade_id and brigade_members disagreeing.
// Transaction-scoped PostgreSQL lock: automatically released on commit/rollback.
export async function lockBrigadeMembership(manager: EntityManager) {
  await manager.query('SELECT pg_advisory_xact_lock(71402, 1)');
}
