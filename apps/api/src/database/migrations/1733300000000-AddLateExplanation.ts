import { MigrationInterface, QueryRunner } from 'typeorm';

// Объяснительная за опоздание: текстовое поле в записи табеля. Существующие
// записи не затрагиваются (поле nullable).
export class AddLateExplanation1733300000000 implements MigrationInterface {
  name = 'AddLateExplanation1733300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "late_explanation" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "attendance_records" DROP COLUMN IF EXISTS "late_explanation"`,
    );
  }
}
