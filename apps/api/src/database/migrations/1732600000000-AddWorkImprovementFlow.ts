import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkImprovementFlow1732600000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE work_standards (
        id SERIAL PRIMARY KEY, work_type_id INTEGER NOT NULL REFERENCES work_types(id),
        version INTEGER NOT NULL, title TEXT NOT NULL, steps JSONB NOT NULL,
        preparation JSONB NOT NULL, acceptance TEXT NOT NULL,
        created_by_id INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(work_type_id, version)
      );
      CREATE TABLE work_task_plans (
        task_id INTEGER PRIMARY KEY REFERENCES tasks(id), standard_id INTEGER NOT NULL REFERENCES work_standards(id),
        accountable_id INTEGER NOT NULL REFERENCES users(id), reviewer_id INTEGER NOT NULL REFERENCES users(id),
        wip_limit INTEGER NOT NULL DEFAULT 1 CHECK(wip_limit BETWEEN 1 AND 5),
        required_tool_ids INTEGER[] NOT NULL DEFAULT '{}', materials JSONB NOT NULL DEFAULT '[]',
        prepared_by_id INTEGER REFERENCES users(id), ready_at TIMESTAMPTZ,
        completed_steps INTEGER[] NOT NULL DEFAULT '{}', checked_preparation INTEGER[] NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE work_tools (
        id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
        home_location TEXT NOT NULL, current_location TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'MAINTENANCE' CHECK(state IN ('READY','ISSUED','MAINTENANCE','RETIRED')),
        task_id INTEGER REFERENCES tasks(id), checked_at TIMESTAMPTZ, checked_by_id INTEGER REFERENCES users(id),
        condition_note TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE work_obstacles (
        id SERIAL PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES tasks(id),
        reporter_id INTEGER NOT NULL REFERENCES users(id), owner_id INTEGER NOT NULL REFERENCES users(id),
        category TEXT NOT NULL CHECK(category IN ('WATER','MATERIAL','TOOL','ACCESS','APP','OTHER')),
        description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','WORKING','RESOLVED','CLOSED')),
        due_at TIMESTAMPTZ, resolution TEXT, verification TEXT, resolved_by_id INTEGER REFERENCES users(id),
        resolved_at TIMESTAMPTZ, closed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        client_operation_id UUID NOT NULL UNIQUE
      );
      CREATE INDEX work_obstacles_task_status ON work_obstacles(task_id, status);
      CREATE TABLE work_improvements (
        id SERIAL PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES tasks(id), obstacle_id INTEGER REFERENCES work_obstacles(id),
        proposer_id INTEGER NOT NULL REFERENCES users(id), owner_id INTEGER REFERENCES users(id),
        problem TEXT NOT NULL, proposal TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PROPOSED' CHECK(status IN ('PROPOSED','TESTING','CHECKING','ADOPTED','REJECTED')),
        hypothesis TEXT, metric TEXT, unit TEXT, direction TEXT CHECK(direction IN ('LOWER','HIGHER')),
        baseline DOUBLE PRECISION, observed DOUBLE PRECISION, evidence TEXT, decision TEXT,
        due_at TIMESTAMPTZ, adopted_standard_id INTEGER REFERENCES work_standards(id),
        checked_by_id INTEGER REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        client_operation_id UUID NOT NULL UNIQUE
      );
      CREATE TABLE work_flow_events (
        id SERIAL PRIMARY KEY, task_id INTEGER REFERENCES tasks(id), actor_id INTEGER NOT NULL REFERENCES users(id),
        kind TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX work_flow_events_task ON work_flow_events(task_id, created_at);
    `);
  }
  async down(): Promise<void> {
    throw new Error('Operational history is retained. Roll back application code without removing workflow tables.');
  }
}
