import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AdminReportStatus } from '../common/enums/admin-report-status.enum';
import { User } from './user.entity';

@Entity('admin_daily_reports')
export class AdminDailyReport {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: 'report_date', type: 'date' })
  reportDate!: string;

  @Column({ name: 'author_id', type: 'int', nullable: true })
  authorId!: number | null;

  @Column({ name: 'completed_works', type: 'text', nullable: true })
  completedWorks!: string | null;

  @Column({ name: 'pending_works', type: 'text', nullable: true })
  pendingWorks!: string | null;

  @Column({ name: 'tasks_in_progress', type: 'text', nullable: true })
  tasksInProgress!: string | null;

  @Column({ name: 'overdue_tasks', type: 'text', nullable: true })
  overdueTasks!: string | null;

  @Column({ name: 'watering_done', type: 'text', nullable: true })
  wateringDone!: string | null;

  @Column({ name: 'planned_liters', type: 'int', nullable: true })
  plannedLiters!: number | null;

  @Column({ name: 'actual_liters', type: 'int', nullable: true })
  actualLiters!: number | null;

  @Column({ type: 'text', nullable: true })
  issues!: string | null;

  @Column({ name: 'attention_objects', type: 'text', nullable: true })
  attentionObjects!: string | null;

  @Column({ name: 'brigades_info', type: 'text', nullable: true })
  brigadesInfo!: string | null;

  @Column({ name: 'water_carriers_info', type: 'text', nullable: true })
  waterCarriersInfo!: string | null;

  @Column({ type: 'text', nullable: true })
  decisions!: string | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ name: 'photo_urls', type: 'text', default: '[]' })
  photoUrls!: string;

  @Column({ type: 'varchar', length: 24, default: AdminReportStatus.DRAFT })
  status!: AdminReportStatus;

  @Column({ name: 'status_history', type: 'text', default: '[]' })
  statusHistory!: string;

  @Column({ name: 'reviewed_by_id', type: 'int', nullable: true })
  reviewedById!: number | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: 'review_comment', type: 'text', nullable: true })
  reviewComment!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'author_id' })
  author!: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewedBy!: User | null;
}
