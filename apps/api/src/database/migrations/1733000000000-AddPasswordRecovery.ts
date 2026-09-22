import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordRecovery1733000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_at timestamptz`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at timestamptz`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_by_id integer REFERENCES users(id) ON DELETE SET NULL`);
  }

  async down(): Promise<void> {
    throw new Error('Credential revocation state must be preserved; automatic destructive rollback is disabled.');
  }
}
