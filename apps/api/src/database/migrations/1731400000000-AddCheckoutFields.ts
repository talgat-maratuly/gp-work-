import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCheckoutFields1731400000000 implements MigrationInterface {
  name = 'AddCheckoutFields1731400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "attendance_records"
      ADD COLUMN "completion_percent" integer,
      ADD COLUMN "extra_values" text
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "attendance_records"
      DROP COLUMN "extra_values",
      DROP COLUMN "completion_percent"
    `);
  }
}
