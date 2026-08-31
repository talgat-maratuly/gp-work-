import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWatering1731000000000 implements MigrationInterface {
  name = 'AddWatering1731000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "watering_records" (
        "id" SERIAL NOT NULL,
        "work_date" date NOT NULL,
        "shift" character varying(16) NOT NULL DEFAULT 'NIGHT',
        "type" character varying(24) NOT NULL DEFAULT 'AUTO',
        "object_id" integer,
        "section_id" integer,
        "water_carrier_id" integer,
        "performer_name" character varying(255),
        "planned_liters" integer,
        "actual_liters" integer,
        "start_time" character varying(16),
        "end_time" character varying(16),
        "comment" text,
        "photo_urls" text NOT NULL DEFAULT '[]',
        "latitude" double precision,
        "longitude" double precision,
        "qr_confirmed" boolean NOT NULL DEFAULT false,
        "status" character varying(24) NOT NULL DEFAULT 'PLANNED',
        "created_by_id" integer,
        "reviewed_by_id" integer,
        "reviewed_at" TIMESTAMPTZ,
        "review_comment" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_watering_records" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_watering_work_date" ON "watering_records" ("work_date")`,
    );

    await queryRunner.query(`
      ALTER TABLE "watering_records"
        ADD CONSTRAINT "FK_watering_object" FOREIGN KEY ("object_id")
          REFERENCES "objects"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_watering_section" FOREIGN KEY ("section_id")
          REFERENCES "sections"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_watering_water_carrier" FOREIGN KEY ("water_carrier_id")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_watering_created_by" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_watering_reviewed_by" FOREIGN KEY ("reviewed_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "watering_records"`);
  }
}
