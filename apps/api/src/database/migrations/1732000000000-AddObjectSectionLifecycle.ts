import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddObjectSectionLifecycle1732000000000 implements MigrationInterface {
  name = 'AddObjectSectionLifecycle1732000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "objects" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "sections" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_objects_active" ON "objects" ("is_active")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sections_active" ON "sections" ("is_active")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sections_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_objects_active"`);
    await queryRunner.query(`ALTER TABLE "sections" DROP COLUMN IF EXISTS "is_active"`);
    await queryRunner.query(`ALTER TABLE "objects" DROP COLUMN IF EXISTS "is_active"`);
  }
}
