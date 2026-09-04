import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkDayLivenessEvidence1731900000000 implements MigrationInterface {
  name = 'AddWorkDayLivenessEvidence1731900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "work_day_sessions" ADD COLUMN IF NOT EXISTS "start_liveness_evidence_urls" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_day_sessions" ADD COLUMN IF NOT EXISTS "end_liveness_evidence_urls" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "work_day_sessions" DROP COLUMN IF EXISTS "end_liveness_evidence_urls"`);
    await queryRunner.query(`ALTER TABLE "work_day_sessions" DROP COLUMN IF EXISTS "start_liveness_evidence_urls"`);
  }
}
