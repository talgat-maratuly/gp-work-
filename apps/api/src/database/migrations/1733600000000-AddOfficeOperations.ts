import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOfficeOperations1733600000000 implements MigrationInterface {
  name = 'AddOfficeOperations1733600000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE office_access (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
      profile VARCHAR(24) NOT NULL CHECK(profile IN ('PROJECT_MANAGER','SUPPLY','FINANCE','ACCOUNTANT','QUALITY','LEGAL','EMPLOYEE')),
      scope VARCHAR(16) NOT NULL CHECK(scope IN ('SELF','DEPARTMENT','COMPANY')),
      enabled BOOLEAN NOT NULL DEFAULT true, revision INTEGER NOT NULL DEFAULT 1,
      updated_by INTEGER REFERENCES users(id), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE TABLE office_projects (
      id SERIAL PRIMARY KEY, code TEXT UNIQUE NOT NULL, title VARCHAR(240) NOT NULL,
      unit_id INTEGER NOT NULL REFERENCES organization_units(id), owner_id INTEGER NOT NULL REFERENCES users(id),
      start_date DATE NOT NULL, due_date DATE NOT NULL, description TEXT NOT NULL DEFAULT '',
      status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','COMPLETED','ARCHIVED')),
      revision INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK(due_date>=start_date)
    )`);
    await q.query(`CREATE TABLE office_project_units (project_id INTEGER REFERENCES office_projects(id), unit_id INTEGER REFERENCES organization_units(id), PRIMARY KEY(project_id,unit_id))`);
    await q.query(`CREATE TABLE office_project_members (project_id INTEGER REFERENCES office_projects(id), user_id INTEGER REFERENCES users(id), PRIMARY KEY(project_id,user_id))`);
    await q.query(`CREATE TABLE office_templates (
      id SERIAL PRIMARY KEY, title VARCHAR(240) NOT NULL, body TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1, approved BOOLEAN NOT NULL DEFAULT false,
      updated_by INTEGER NOT NULL REFERENCES users(id), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE TABLE office_records (
      id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES office_projects(id),
      kind VARCHAR(16) NOT NULL CHECK(kind IN ('TASK','CONTRACT','BUDGET','PURCHASE','RECEIPT','INVOICE','PAYMENT')),
      code TEXT NOT NULL UNIQUE, title VARCHAR(240) NOT NULL, status VARCHAR(24) NOT NULL,
      parent_id INTEGER REFERENCES office_records(id), assignee_id INTEGER REFERENCES users(id),
      amount BIGINT NOT NULL DEFAULT 0 CHECK(amount>=0 AND amount<=9000000000000),
      due_date DATE, data JSONB NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await q.query('CREATE INDEX office_records_project_kind_idx ON office_records(project_id,kind,id)');
    await q.query('CREATE INDEX office_records_parent_idx ON office_records(parent_id)');
    await q.query(`CREATE TABLE office_documents (
      id SERIAL PRIMARY KEY, record_id INTEGER NOT NULL REFERENCES office_records(id),
      name VARCHAR(240) NOT NULL, mime VARCHAR(80) NOT NULL, content BYTEA NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE TABLE office_events (
      id SERIAL PRIMARY KEY, project_id INTEGER REFERENCES office_projects(id), record_id INTEGER REFERENCES office_records(id),
      category VARCHAR(24) NOT NULL, actor_id INTEGER NOT NULL REFERENCES users(id), action TEXT NOT NULL,
      before_data JSONB, after_data JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await q.query('CREATE INDEX office_events_project_idx ON office_events(project_id,id)');
    await q.query(`CREATE TABLE office_counters (kind VARCHAR(16), year INTEGER, value INTEGER NOT NULL, PRIMARY KEY(kind,year))`);
    await q.query(`CREATE TABLE office_requests (
      user_id INTEGER REFERENCES users(id), request_id UUID, operation TEXT NOT NULL, digest TEXT NOT NULL,
      result JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(user_id,request_id)
    )`);
  }
  async down(): Promise<void> {
    throw new Error('Office financial records and access history must be preserved; roll back code without dropping data.');
  }
}
