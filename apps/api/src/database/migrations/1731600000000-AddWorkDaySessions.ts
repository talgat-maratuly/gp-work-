import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkDaySessions1731600000000 implements MigrationInterface {
  name = 'AddWorkDaySessions1731600000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "work_day_sessions" (
      "id" SERIAL NOT NULL, "client_session_id" uuid NOT NULL,
      "user_id" integer NOT NULL, "section_id" integer NOT NULL, "shift_date" date NOT NULL,
      "status" varchar(20) NOT NULL DEFAULT 'OPEN', "started_at" timestamptz NOT NULL DEFAULT now(), "closed_at" timestamptz,
      "start_qr" varchar(100) NOT NULL, "end_qr" varchar(100),
      "start_latitude" double precision NOT NULL, "start_longitude" double precision NOT NULL,
      "start_accuracy" double precision, "start_distance_meters" double precision,
      "end_latitude" double precision, "end_longitude" double precision, "end_accuracy" double precision, "end_distance_meters" double precision,
      "start_selfie_url" text NOT NULL, "end_selfie_url" text, "start_photo_url" text NOT NULL,
      "result_photo_urls" jsonb NOT NULL DEFAULT '[]'::jsonb, "overall_percent" smallint NOT NULL DEFAULT 0,
      "summary" text, "incomplete_reasons" jsonb NOT NULL DEFAULT '{}'::jsonb, "events" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "reviewed_by_id" integer, "reviewed_at" timestamptz, "review_comment" text,
      "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_work_day_sessions" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_work_day_client_session" UNIQUE ("client_session_id"),
      CONSTRAINT "FK_work_day_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_work_day_section" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT,
      CONSTRAINT "CK_work_day_percent" CHECK ("overall_percent" BETWEEN 0 AND 100)
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_work_day_open_user" ON "work_day_sessions" ("user_id") WHERE "status" = 'OPEN'`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_work_day_shift_date" ON "work_day_sessions" ("shift_date", "status")`);
  }
  async down(q: QueryRunner): Promise<void> { await q.query(`DROP TABLE IF EXISTS "work_day_sessions"`); }
}
