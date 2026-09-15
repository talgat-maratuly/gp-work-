import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusinessProcesses1732700000000 implements MigrationInterface {
  name = 'AddBusinessProcesses1732700000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE business_processes (
      id SERIAL PRIMARY KEY, archived BOOLEAN NOT NULL DEFAULT false,
      created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE TABLE business_process_definitions (
      id SERIAL PRIMARY KEY, process_id INTEGER NOT NULL REFERENCES business_processes(id),
      version INTEGER NOT NULL CHECK(version > 0), schema JSONB NOT NULL,
      created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(process_id, version), UNIQUE(id, process_id)
    )`);
    await q.query(`CREATE TABLE business_process_instances (
      id SERIAL PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
      definition_id INTEGER NOT NULL, process_id INTEGER NOT NULL,
      stage_id VARCHAR(64) NOT NULL, values JSONB NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 1,
      created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      FOREIGN KEY(definition_id, process_id) REFERENCES business_process_definitions(id, process_id),
      UNIQUE(task_id, process_id)
    )`);
    await q.query(`CREATE TABLE business_process_events (
      id SERIAL PRIMARY KEY, instance_id INTEGER NOT NULL REFERENCES business_process_instances(id),
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL, kind VARCHAR(24) NOT NULL,
      from_stage_id VARCHAR(64), to_stage_id VARCHAR(64) NOT NULL, changes JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await q.query('CREATE INDEX business_process_events_instance_idx ON business_process_events(instance_id, id)');
  }
  async down(): Promise<void> {
    throw new Error('Business process history is preserved. Revert application code without removing these additive tables.');
  }
}
