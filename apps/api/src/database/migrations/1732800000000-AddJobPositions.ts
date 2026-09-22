import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJobPositions1732800000000 implements MigrationInterface {
  name = 'AddJobPositions1732800000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE job_positions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL CHECK (length(trim(name)) > 0),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await q.query('CREATE UNIQUE INDEX job_positions_name_unique ON job_positions (lower(name))');
    await q.query(`ALTER TABLE users ADD COLUMN position_id INTEGER
      REFERENCES job_positions(id) ON DELETE RESTRICT`);
    await q.query('CREATE INDEX users_position_idx ON users(position_id)');
  }

  async down(): Promise<void> {
    throw new Error('Job positions and employee assignments are preserved. Revert application code without removing these additive fields.');
  }
}
