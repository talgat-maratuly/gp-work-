import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendTaskLifecycle1730900000000 implements MigrationInterface {
  name = 'ExtendTaskLifecycle1730900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN "accepted_at" TIMESTAMPTZ,
      ADD COLUMN "completed_at" TIMESTAMPTZ,
      ADD COLUMN "completion_photo_urls" text NOT NULL DEFAULT '[]',
      ADD COLUMN "completion_comment" text,
      ADD COLUMN "reviewed_by_id" integer,
      ADD COLUMN "reviewed_at" TIMESTAMPTZ,
      ADD COLUMN "review_comment" text
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD CONSTRAINT "FK_tasks_reviewed_by" FOREIGN KEY ("reviewed_by_id")
        REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP CONSTRAINT "FK_tasks_reviewed_by",
      DROP COLUMN "review_comment",
      DROP COLUMN "reviewed_at",
      DROP COLUMN "reviewed_by_id",
      DROP COLUMN "completion_comment",
      DROP COLUMN "completion_photo_urls",
      DROP COLUMN "completed_at",
      DROP COLUMN "accepted_at"
    `);
  }
}
