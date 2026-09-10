import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncWorkDayAttendancePercent1732500000000 implements MigrationInterface {
  name = 'SyncWorkDayAttendancePercent1732500000000';

  async up(q: QueryRunner): Promise<void> {
    // Preserve historical checkout values. Backfill only one identified shift per user/date.
    await q.query(`
      UPDATE attendance_records a SET completion_percent = s.percent
      FROM (
        SELECT user_id, shift_date, MAX(overall_percent) AS percent
        FROM work_day_sessions
        WHERE status IN ('CLOSED', 'REVIEWED')
        GROUP BY user_id, shift_date HAVING COUNT(*) = 1
      ) s
      WHERE a.user_id = s.user_id AND a.work_date = s.shift_date
        AND a.completion_percent IS NULL
    `);
  }

  async down(): Promise<void> {
    // Evidence values are deliberately retained when rolling back application code.
  }
}
