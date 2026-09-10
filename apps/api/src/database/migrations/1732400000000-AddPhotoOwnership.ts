import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhotoOwnership1732400000000 implements MigrationInterface {
  name = 'AddPhotoOwnership1732400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Existing files remain in place. Do not guess their owner from a filename
    // or a person's display name; legacy reads use the linked business record.
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS uploaded_photos (
      filename text PRIMARY KEY,
      owner_user_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT NOW()
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_uploaded_photos_owner ON uploaded_photos(owner_user_id)`);
    // Preserve resumable shifts and historical evidence. Only an unambiguous
    // persisted user ID may establish a legacy owner; orphan/ambiguous files
    // remain readable through record permissions but cannot be newly attached.
    await queryRunner.query(`
      WITH evidence_refs AS (
        SELECT url, uploaded_by_id AS owner_id FROM work_photos WHERE uploaded_by_id IS NOT NULL
        UNION ALL SELECT selfie_url, user_id FROM face_verifications
        UNION ALL SELECT jsonb_array_elements_text(liveness_evidence_urls), user_id FROM face_verifications
        UNION ALL SELECT start_selfie_url, user_id FROM work_day_sessions
        UNION ALL SELECT end_selfie_url, user_id FROM work_day_sessions
        UNION ALL SELECT start_photo_url, user_id FROM work_day_sessions
        UNION ALL SELECT jsonb_array_elements_text(start_liveness_evidence_urls), user_id FROM work_day_sessions
        UNION ALL SELECT jsonb_array_elements_text(end_liveness_evidence_urls), user_id FROM work_day_sessions
        UNION ALL SELECT jsonb_array_elements_text(result_photo_urls), user_id FROM work_day_sessions
      ), candidates AS (
        SELECT regexp_replace(url, '^.*\/uploads\/photos\/', '') AS filename, owner_id FROM evidence_refs
        WHERE url ~ '^((https?://[^/]+)?/uploads/photos/)[A-Za-z0-9][A-Za-z0-9._-]*\\.(jpg|jpeg|png|webp|heic|heif)$'
      )
      INSERT INTO uploaded_photos(filename, owner_user_id)
      SELECT filename, MIN(owner_id) FROM candidates
      GROUP BY filename HAVING COUNT(DISTINCT owner_id) = 1
      ON CONFLICT (filename) DO NOTHING
    `);
  }

  async down(): Promise<void> {
    // Preserve the ownership registry on application rollback.
  }
}
