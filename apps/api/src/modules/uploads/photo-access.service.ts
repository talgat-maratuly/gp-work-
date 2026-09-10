import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../../entities';
import { UserRole } from '../../common/enums/user-role.enum';

@Injectable()
export class PhotoAccessService {
  constructor(private readonly db: DataSource) {}

  async register(filenames: string[], ownerId: number): Promise<void> {
    await this.db.query(
      'INSERT INTO uploaded_photos(filename, owner_user_id) SELECT unnest($1::text[]), $2',
      [filenames, ownerId],
    );
  }

  async assertOwner(filenames: string[], user: User): Promise<void> {
    if (!filenames.length) return;
    const rows = await this.db.query(
      'SELECT filename FROM uploaded_photos WHERE filename = ANY($1::text[]) AND owner_user_id = $2',
      [filenames, user.id],
    );
    const owned = new Set(rows.map((row: { filename: string }) => row.filename));
    if (filenames.some((filename) => !owned.has(filename))) {
      throw new ForbiddenException('Используйте фотографии, загруженные вами');
    }
  }

  async assertCanRead(filename: string, user: User): Promise<void> {
    if ([UserRole.ADMIN, UserRole.DIRECTOR].includes(user.role)) return;
    const owned = await this.db.query(
      'SELECT 1 FROM uploaded_photos WHERE filename = $1 AND owner_user_id = $2', [filename, user.id],
    );
    if (owned.length) return;
    const relative = `/uploads/photos/${filename}`;
    const urls = [relative, ...[process.env.FRONTEND_URL, process.env.API_PUBLIC_URL]
      .flatMap((value) => (value || '').split(','))
      .filter(Boolean).map((origin) => `${origin.trim().replace(/\/$/, '').replace(/\/api$/, '')}${relative}`)];
    // Read permission follows the record containing the evidence. Knowing a URL
    // or belonging to an unrelated brigade never grants access to a selfie.
    const matches = await this.db.query(`
      SELECT 1 FROM work_day_sessions s JOIN users u ON u.id = s.user_id
      WHERE (s.start_selfie_url = ANY($1::text[]) OR s.end_selfie_url = ANY($1::text[])
        OR s.start_photo_url = ANY($1::text[]) OR s.result_photo_urls ?| $1::text[]
        OR s.start_liveness_evidence_urls ?| $1::text[] OR s.end_liveness_evidence_urls ?| $1::text[])
        AND (s.user_id = $2 OR ($4 = 'BRIGADIER' AND u.brigade_id = $3) OR $4 = 'AGRONOMIST')
      UNION ALL
      SELECT 1 FROM work_executions e JOIN tasks t ON t.id = e.task_id
      WHERE (EXISTS (SELECT 1 FROM work_photos p WHERE p.execution_id = e.id AND p.url = ANY($1::text[]))
        OR EXISTS (SELECT 1 FROM face_verifications f WHERE f.execution_id = e.id
          AND (f.selfie_url = ANY($1::text[]) OR f.liveness_evidence_urls ?| $1::text[])))
        AND (e.worker_user_id = $2 OR t.assignee_user_id = $2
          OR ($4 IN ('WORKER','WATER_CARRIER','BRIGADIER','AGRONOMIST') AND e.brigade_id = $3)
          OR ($4 = 'AGRONOMIST' AND t.created_by_id = $2))
      UNION ALL
      SELECT 1 FROM work_logs w
      WHERE w.photo_urls::jsonb ?| $1::text[] AND (w.user_id = $2
        OR ($4 = 'BRIGADIER' AND w.brigade_id = $3) OR $4 IN ('AGRONOMIST','AKIMAT','ANTICOR'))
      UNION ALL
      SELECT 1 FROM tasks t WHERE t.completion_photo_urls::jsonb ?| $1::text[]
        AND (t.assignee_user_id = $2 OR t.brigade_id = $3 OR ($4 = 'AGRONOMIST' AND t.created_by_id = $2))
      UNION ALL
      SELECT 1 FROM watering_records w WHERE w.photo_urls::jsonb ?| $1::text[]
        AND $4 IN ('BRIGADIER','AGRONOMIST','WATER_CARRIER','AKIMAT','ANTICOR')
      UNION ALL
      SELECT 1 FROM admin_daily_reports r WHERE r.photo_urls::jsonb ?| $1::text[] AND $4 IN ('AKIMAT','ANTICOR')
      UNION ALL
      SELECT 1 FROM ai_agronom_analyses a WHERE a.photo_url = ANY($1::text[]) AND a.created_by_id = $2
      LIMIT 1`, [urls, user.id, user.brigadeId ?? null, user.role]);
    if (!matches.length) throw new NotFoundException('Фото недоступно');
  }
}
