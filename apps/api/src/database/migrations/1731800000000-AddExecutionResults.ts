import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExecutionResults1731800000000 implements MigrationInterface {
  name = 'AddExecutionResults1731800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "work_executions" ADD COLUMN IF NOT EXISTS "completion_percent" smallint`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_executions" ADD COLUMN IF NOT EXISTS "actual_volume" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_executions" ADD COLUMN IF NOT EXISTS "completion_description" text`,
    );
    await queryRunner.query(
      `DO $$ BEGIN ALTER TABLE "work_executions" ADD CONSTRAINT "CK_work_execution_percent" CHECK ("completion_percent" BETWEEN 0 AND 100); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "work_executions" DROP CONSTRAINT IF EXISTS "CK_work_execution_percent"`);
    await queryRunner.query(`ALTER TABLE "work_executions" DROP COLUMN IF EXISTS "completion_description"`);
    await queryRunner.query(`ALTER TABLE "work_executions" DROP COLUMN IF EXISTS "actual_volume"`);
    await queryRunner.query(`ALTER TABLE "work_executions" DROP COLUMN IF EXISTS "completion_percent"`);
  }
}
