import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Section } from './section.entity';
import { User } from './user.entity';

export enum WorkDayStatus { OPEN = 'OPEN', CLOSED = 'CLOSED', REVIEWED = 'REVIEWED', RETURNED = 'RETURNED' }

export interface WorkDayTaskScope {
  taskId: number;
  description: string;
}

export interface WorkDayTaskResult extends WorkDayTaskScope {
  percent: number;
  actualVolume: string | null;
  workDescription: string | null;
  incompleteReason: string | null;
}

@Entity('work_day_sessions')
@Index('uq_work_day_open_user', ['userId'], { unique: true, where: `status = 'OPEN'` })
export class WorkDaySession {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'client_session_id', type: 'uuid', unique: true }) clientSessionId!: string;
  @Column({ name: 'user_id', type: 'int' }) userId!: number;
  @Column({ name: 'section_id', type: 'int' }) sectionId!: number;
  @Column({ name: 'shift_date', type: 'date' }) shiftDate!: string;
  @Column({ type: 'varchar', length: 20, default: WorkDayStatus.OPEN }) status!: WorkDayStatus;
  @Column({ name: 'started_at', type: 'timestamptz' }) startedAt!: Date;
  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true }) closedAt!: Date | null;
  @Column({ name: 'start_qr', type: 'varchar', length: 100 }) startQr!: string;
  @Column({ name: 'end_qr', type: 'varchar', length: 100, nullable: true }) endQr!: string | null;
  @Column({ name: 'start_latitude', type: 'double precision' }) startLatitude!: number;
  @Column({ name: 'start_longitude', type: 'double precision' }) startLongitude!: number;
  @Column({ name: 'start_accuracy', type: 'double precision', nullable: true }) startAccuracy!: number | null;
  @Column({ name: 'start_distance_meters', type: 'double precision', nullable: true }) startDistanceMeters!: number | null;
  @Column({ name: 'end_latitude', type: 'double precision', nullable: true }) endLatitude!: number | null;
  @Column({ name: 'end_longitude', type: 'double precision', nullable: true }) endLongitude!: number | null;
  @Column({ name: 'end_accuracy', type: 'double precision', nullable: true }) endAccuracy!: number | null;
  @Column({ name: 'end_distance_meters', type: 'double precision', nullable: true }) endDistanceMeters!: number | null;
  @Column({ name: 'start_selfie_url', type: 'text' }) startSelfieUrl!: string;
  @Column({ name: 'end_selfie_url', type: 'text', nullable: true }) endSelfieUrl!: string | null;
  @Column({ name: 'start_liveness_evidence_urls', type: 'jsonb', default: () => "'[]'::jsonb" }) startLivenessEvidenceUrls!: string[];
  @Column({ name: 'end_liveness_evidence_urls', type: 'jsonb', default: () => "'[]'::jsonb" }) endLivenessEvidenceUrls!: string[];
  @Column({ name: 'start_photo_url', type: 'text' }) startPhotoUrl!: string;
  @Column({ name: 'result_photo_urls', type: 'jsonb', default: () => "'[]'::jsonb" }) resultPhotoUrls!: string[];
  @Column({ name: 'task_scope', type: 'jsonb', default: () => "'[]'::jsonb" }) taskScope!: WorkDayTaskScope[];
  @Column({ name: 'task_results', type: 'jsonb', default: () => "'[]'::jsonb" }) taskResults!: WorkDayTaskResult[];
  @Column({ name: 'overall_percent', type: 'smallint', default: 0 }) overallPercent!: number;
  @Column({ name: 'summary', type: 'text', nullable: true }) summary!: string | null;
  @Column({ name: 'incomplete_reasons', type: 'jsonb', default: () => "'{}'::jsonb" }) incompleteReasons!: Record<string, string>;
  @Column({ name: 'events', type: 'jsonb', default: () => "'[]'::jsonb" }) events!: Record<string, unknown>[];
  @Column({ name: 'reviewed_by_id', type: 'int', nullable: true }) reviewedById!: number | null;
  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true }) reviewedAt!: Date | null;
  @Column({ name: 'review_comment', type: 'text', nullable: true }) reviewComment!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'user_id' }) user!: User;
  @ManyToOne(() => Section, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'section_id' }) section!: Section;
}
