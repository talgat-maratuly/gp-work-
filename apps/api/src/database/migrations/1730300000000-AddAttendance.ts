import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAttendance1730300000000 implements MigrationInterface {
  name = 'AddAttendance1730300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "attendance_records" (
        "id" SERIAL NOT NULL,
        "work_date" date NOT NULL,
        "worker_full_name" character varying NOT NULL,
        "check_in_time" TIMESTAMPTZ NOT NULL,
        "check_out_time" TIMESTAMPTZ,
        "last_activity_time" TIMESTAMPTZ NOT NULL,
        "check_in_latitude" double precision,
        "check_in_longitude" double precision,
        "check_out_latitude" double precision,
        "check_out_longitude" double precision,
        "worked_hours" numeric(8,2),
        "status" character varying(32) NOT NULL DEFAULT 'ON_DUTY',
        "report_count" integer NOT NULL DEFAULT 1,
        "first_work_log_id" integer,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_attendance_records" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_attendance_date_worker" UNIQUE ("work_date", "worker_full_name"),
        CONSTRAINT "FK_attendance_first_work_log" FOREIGN KEY ("first_work_log_id")
          REFERENCES "work_logs"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_attendance_work_date" ON "attendance_records" ("work_date")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "attendance_records"`);
  }
}
