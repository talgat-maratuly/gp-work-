import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFormSettings1730800000000 implements MigrationInterface {
  name = 'AddFormSettings1730800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "form_settings" (
        "id" SERIAL NOT NULL,
        "key" character varying NOT NULL,
        "settings_json" text NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_form_settings_key" UNIQUE ("key"),
        CONSTRAINT "PK_form_settings" PRIMARY KEY ("id")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "form_settings"`);
  }
}
