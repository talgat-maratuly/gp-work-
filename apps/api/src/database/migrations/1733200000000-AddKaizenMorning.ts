import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKaizenMorning1733200000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE work_kaizen_answers (
      id SERIAL PRIMARY KEY, author_id INTEGER NOT NULL REFERENCES users(id),
      business_day DATE NOT NULL, task_id INTEGER REFERENCES tasks(id),
      problem TEXT NOT NULL, next_step TEXT NOT NULL, result TEXT NOT NULL DEFAULT '',
      proposal TEXT NOT NULL DEFAULT '', improvement_id INTEGER REFERENCES work_improvements(id),
      client_operation_id UUID NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(author_id, business_day)
    );
    CREATE INDEX work_kaizen_answers_day ON work_kaizen_answers(business_day DESC);
    CREATE TABLE work_kaizen_replies (
      id SERIAL PRIMARY KEY, answer_id INTEGER NOT NULL REFERENCES work_kaizen_answers(id),
      author_id INTEGER NOT NULL REFERENCES users(id), note TEXT NOT NULL, is_management BOOLEAN NOT NULL,
      client_operation_id UUID NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX work_kaizen_replies_answer ON work_kaizen_replies(answer_id);`);
  }
  async down(q: QueryRunner): Promise<void> {
    void q;
    throw new Error('Keep kaizen history. Roll back application code without deleting discussion tables.');
  }
}
