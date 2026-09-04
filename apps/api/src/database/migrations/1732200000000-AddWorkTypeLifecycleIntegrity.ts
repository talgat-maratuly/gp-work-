import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkTypeLifecycleIntegrity1732200000000 implements MigrationInterface {
  name = 'AddWorkTypeLifecycleIntegrity1732200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_work_types_normalized_name" ON "work_types" (LOWER(BTRIM("name")))`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_work_types_normalized_name"`);
  }
}
