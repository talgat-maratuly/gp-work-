import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddImportantPlanning1733400000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE work_task_focus (
      task_id INTEGER PRIMARY KEY REFERENCES tasks(id),
      important BOOLEAN NOT NULL, urgent BOOLEAN NOT NULL,
      outcome TEXT NOT NULL CHECK(length(trim(outcome)) > 0),
      start_at TIMESTAMPTZ NOT NULL, end_at TIMESTAMPTZ NOT NULL CHECK(end_at > start_at),
      improvement_id INTEGER REFERENCES work_improvements(id),
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX work_task_focus_time ON work_task_focus(start_at, end_at);
    CREATE TABLE work_task_focus_history (
      id SERIAL PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES tasks(id),
      actor_id INTEGER NOT NULL REFERENCES users(id), reason TEXT NOT NULL,
      before_value JSONB, after_value JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX work_task_focus_history_task ON work_task_focus_history(task_id, id);`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE work_task_focus_history; DROP TABLE work_task_focus');
  }
}
