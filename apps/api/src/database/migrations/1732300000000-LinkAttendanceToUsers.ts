import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkAttendanceToUsers1732300000000 implements MigrationInterface {
  name = 'LinkAttendanceToUsers1732300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "user_id" integer`);
    await queryRunner.query(`
      UPDATE "attendance_records" attendance
      SET "user_id" = matched."id"
      FROM (
        SELECT MIN("id") AS "id", LOWER(BTRIM("full_name")) AS normalized_name
        FROM "users"
        GROUP BY LOWER(BTRIM("full_name"))
        HAVING COUNT(*) = 1
      ) matched
      WHERE attendance."user_id" IS NULL
        AND LOWER(BTRIM(attendance."worker_full_name")) = matched.normalized_name
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "attendance_records"
          ADD CONSTRAINT "FK_attendance_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_attendance_date_user" ON "attendance_records" ("work_date", "user_id") WHERE "user_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_records" DROP CONSTRAINT IF EXISTS "UQ_attendance_date_worker"`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_attendance_date_worker_name" ON "attendance_records" ("work_date", "worker_full_name")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_attendance_date_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_attendance_date_worker_name"`);
    await queryRunner.query(
      `ALTER TABLE "attendance_records" ADD CONSTRAINT "UQ_attendance_date_worker" UNIQUE ("work_date", "worker_full_name")`,
    );
    await queryRunner.query(`ALTER TABLE "attendance_records" DROP CONSTRAINT IF EXISTS "FK_attendance_user"`);
    await queryRunner.query(`ALTER TABLE "attendance_records" DROP COLUMN IF EXISTS "user_id"`);
  }
}
