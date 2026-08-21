import { MigrationInterface, QueryRunner } from 'typeorm';

export class PhoneToUsername1730200000000 implements MigrationInterface {
  name = 'PhoneToUsername1730200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "phone" TO "username"`);
    await queryRunner.query(
      `ALTER TABLE "users" RENAME CONSTRAINT "UQ_users_phone" TO "UQ_users_username"`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" RENAME CONSTRAINT "UQ_users_username" TO "UQ_users_phone"`,
    );
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "username" TO "phone"`);
  }
}
