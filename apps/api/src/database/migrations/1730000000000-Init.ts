import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1730000000000 implements MigrationInterface {
  name = 'Init1730000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "objects" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_objects" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "work_types" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "is_other" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_work_types" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_work_types_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "sections" (
        "id" SERIAL NOT NULL,
        "object_id" integer NOT NULL,
        "code" character varying NOT NULL,
        "name" character varying NOT NULL,
        "area" text,
        "culture" text,
        "custom_text" text,
        "qr_code_url" text,
        "form_url" text,
        "latitude" double precision,
        "longitude" double precision,
        "radius_meters" integer,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sections" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sections_code" UNIQUE ("code"),
        CONSTRAINT "FK_sections_object" FOREIGN KEY ("object_id")
          REFERENCES "objects"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "work_logs" (
        "id" SERIAL NOT NULL,
        "section_id" integer NOT NULL,
        "worker_full_name" character varying NOT NULL,
        "work_type_id" integer,
        "custom_work_type" text,
        "work_volume" character varying NOT NULL,
        "comment" text NOT NULL DEFAULT '',
        "photo_urls" text NOT NULL DEFAULT '[]',
        "latitude" double precision,
        "longitude" double precision,
        "location_accuracy" double precision,
        "location_allowed" boolean NOT NULL DEFAULT false,
        "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_work_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_work_logs_section" FOREIGN KEY ("section_id")
          REFERENCES "sections"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_work_logs_work_type" FOREIGN KEY ("work_type_id")
          REFERENCES "work_types"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_work_logs_submitted_at" ON "work_logs" ("submitted_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_work_logs_worker_full_name" ON "work_logs" ("worker_full_name")
    `);

    await queryRunner.query(`
      CREATE TABLE "section_code_counter" (
        "id" integer NOT NULL DEFAULT 1,
        "value" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_section_code_counter" PRIMARY KEY ("id")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "section_code_counter"`);
    await queryRunner.query(`DROP INDEX "IDX_work_logs_worker_full_name"`);
    await queryRunner.query(`DROP INDEX "IDX_work_logs_submitted_at"`);
    await queryRunner.query(`DROP TABLE "work_logs"`);
    await queryRunner.query(`DROP TABLE "sections"`);
    await queryRunner.query(`DROP TABLE "work_types"`);
    await queryRunner.query(`DROP TABLE "objects"`);
  }
}
