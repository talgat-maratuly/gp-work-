import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScheduleEntries1731200000000 implements MigrationInterface {
  name = 'AddScheduleEntries1731200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "schedule_entries" (
        "id" SERIAL NOT NULL,
        "planned_date" date NOT NULL,
        "object_id" integer,
        "section_id" integer,
        "work_type_id" integer,
        "brigade_id" integer,
        "assignee_user_id" integer,
        "task_id" integer,
        "status" character varying(24) NOT NULL DEFAULT 'PLANNED',
        "reschedule_reason" text,
        "comment" text,
        "status_history" text NOT NULL DEFAULT '[]',
        "created_by_id" integer,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_schedule_entries" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_schedule_planned_date" ON "schedule_entries" ("planned_date")`,
    );

    await queryRunner.query(`
      ALTER TABLE "schedule_entries"
        ADD CONSTRAINT "FK_schedule_object" FOREIGN KEY ("object_id")
          REFERENCES "objects"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_schedule_section" FOREIGN KEY ("section_id")
          REFERENCES "sections"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_schedule_work_type" FOREIGN KEY ("work_type_id")
          REFERENCES "work_types"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_schedule_brigade" FOREIGN KEY ("brigade_id")
          REFERENCES "brigades"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_schedule_assignee" FOREIGN KEY ("assignee_user_id")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_schedule_task" FOREIGN KEY ("task_id")
          REFERENCES "tasks"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_schedule_created_by" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "schedule_entries"`);
  }
}
