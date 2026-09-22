import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAttendanceAccuracy1732900000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS check_in_accuracy double precision`);
    await queryRunner.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS check_out_accuracy double precision`);
    await queryRunner.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS clock_managed boolean NOT NULL DEFAULT false`);
  }

  async down(): Promise<void> {
    throw new Error('Attendance locations are historical evidence; automatic destructive rollback is disabled.');
  }
}
