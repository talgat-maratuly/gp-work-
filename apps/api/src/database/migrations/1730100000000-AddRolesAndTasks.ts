import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRolesAndTasks1730100000000 implements MigrationInterface {
  name = 'AddRolesAndTasks1730100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" SERIAL NOT NULL,
        "full_name" character varying NOT NULL,
        "phone" character varying NOT NULL,
        "password_hash" text,
        "role" character varying(32) NOT NULL DEFAULT 'WORKER',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_phone" UNIQUE ("phone")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "brigades" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "brigadier_id" integer,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_brigades" PRIMARY KEY ("id"),
        CONSTRAINT "FK_brigades_brigadier" FOREIGN KEY ("brigadier_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "brigade_id" integer,
      ADD CONSTRAINT "FK_users_brigade" FOREIGN KEY ("brigade_id")
        REFERENCES "brigades"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "brigade_members" (
        "id" SERIAL NOT NULL,
        "brigade_id" integer NOT NULL,
        "user_id" integer NOT NULL,
        "joined_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_brigade_members" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_brigade_members" UNIQUE ("brigade_id", "user_id"),
        CONSTRAINT "FK_brigade_members_brigade" FOREIGN KEY ("brigade_id")
          REFERENCES "brigades"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_brigade_members_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tasks" (
        "id" SERIAL NOT NULL,
        "section_id" integer NOT NULL,
        "work_type_id" integer,
        "assignee_user_id" integer,
        "brigade_id" integer,
        "due_date" date,
        "priority" character varying(16) NOT NULL DEFAULT 'MEDIUM',
        "description" text NOT NULL DEFAULT '',
        "status" character varying(32) NOT NULL DEFAULT 'ASSIGNED',
        "category" character varying(16) NOT NULL DEFAULT 'WORK',
        "created_by_id" integer,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tasks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tasks_section" FOREIGN KEY ("section_id")
          REFERENCES "sections"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tasks_work_type" FOREIGN KEY ("work_type_id")
          REFERENCES "work_types"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_tasks_assignee" FOREIGN KEY ("assignee_user_id")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_tasks_brigade" FOREIGN KEY ("brigade_id")
          REFERENCES "brigades"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_tasks_created_by" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "work_logs"
      ADD COLUMN "task_id" integer,
      ADD COLUMN "review_status" character varying(32) NOT NULL DEFAULT 'PENDING',
      ADD COLUMN "reviewed_by_id" integer,
      ADD COLUMN "review_comment" text,
      ADD COLUMN "reviewed_at" TIMESTAMPTZ,
      ADD CONSTRAINT "FK_work_logs_task" FOREIGN KEY ("task_id")
        REFERENCES "tasks"("id") ON DELETE SET NULL,
      ADD CONSTRAINT "FK_work_logs_reviewed_by" FOREIGN KEY ("reviewed_by_id")
        REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "sections"
      ADD COLUMN "care_status" character varying(64),
      ADD COLUMN "care_problems" text NOT NULL DEFAULT '[]',
      ADD COLUMN "care_recommendation" text
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tasks_section_id" ON "tasks" ("section_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_tasks_status" ON "tasks" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_work_logs_review_status" ON "work_logs" ("review_status")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_work_logs_review_status"`);
    await queryRunner.query(`DROP INDEX "IDX_tasks_status"`);
    await queryRunner.query(`DROP INDEX "IDX_tasks_section_id"`);

    await queryRunner.query(`
      ALTER TABLE "sections"
      DROP COLUMN "care_recommendation",
      DROP COLUMN "care_problems",
      DROP COLUMN "care_status"
    `);

    await queryRunner.query(`
      ALTER TABLE "work_logs"
      DROP CONSTRAINT "FK_work_logs_reviewed_by",
      DROP CONSTRAINT "FK_work_logs_task",
      DROP COLUMN "reviewed_at",
      DROP COLUMN "review_comment",
      DROP COLUMN "reviewed_by_id",
      DROP COLUMN "review_status",
      DROP COLUMN "task_id"
    `);

    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`DROP TABLE "brigade_members"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_brigade"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "brigade_id"`);
    await queryRunner.query(`DROP TABLE "brigades"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
