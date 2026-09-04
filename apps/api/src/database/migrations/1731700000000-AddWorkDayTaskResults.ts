import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkDayTaskResults1731700000000 implements MigrationInterface {
  name = 'AddWorkDayTaskResults1731700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "work_day_sessions" ADD COLUMN IF NOT EXISTS "task_scope" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_day_sessions" ADD COLUMN IF NOT EXISTS "task_results" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "work_day_sessions" DROP COLUMN IF EXISTS "task_results"`);
    await queryRunner.query(`ALTER TABLE "work_day_sessions" DROP COLUMN IF EXISTS "task_scope"`);
  }
}
