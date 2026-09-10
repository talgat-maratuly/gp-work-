import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskLifecycleIntegrity1732100000000 implements MigrationInterface {
  name = 'AddTaskLifecycleIntegrity1732100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_tasks_status" ON "tasks" ("status")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_active_route_stop_task" ON "route_stops" ("task_id") WHERE "status" NOT IN ('COMPLETED', 'SKIPPED')`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_active_route_stop_task"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tasks_status"`);
  }
}
