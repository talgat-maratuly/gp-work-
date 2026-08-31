import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminDailyReports1731100000000 implements MigrationInterface {
  name = 'AddAdminDailyReports1731100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "admin_daily_reports" (
        "id" SERIAL NOT NULL,
        "report_date" date NOT NULL,
        "author_id" integer,
        "completed_works" text,
        "pending_works" text,
        "tasks_in_progress" text,
        "overdue_tasks" text,
        "watering_done" text,
        "planned_liters" integer,
        "actual_liters" integer,
        "issues" text,
        "attention_objects" text,
        "brigades_info" text,
        "water_carriers_info" text,
        "decisions" text,
        "comment" text,
        "photo_urls" text NOT NULL DEFAULT '[]',
        "status" character varying(24) NOT NULL DEFAULT 'DRAFT',
        "status_history" text NOT NULL DEFAULT '[]',
        "reviewed_by_id" integer,
        "reviewed_at" TIMESTAMPTZ,
        "review_comment" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_daily_reports" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_admin_reports_date" ON "admin_daily_reports" ("report_date")`,
    );

    await queryRunner.query(`
      ALTER TABLE "admin_daily_reports"
        ADD CONSTRAINT "FK_admin_reports_author" FOREIGN KEY ("author_id")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_admin_reports_reviewed_by" FOREIGN KEY ("reviewed_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "admin_daily_reports"`);
  }
}
