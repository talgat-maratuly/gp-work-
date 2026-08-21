import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReviewStatus } from '../common/enums/review-status.enum';
import { Section } from './section.entity';
import { Task } from './task.entity';
import { User } from './user.entity';
import { WorkType } from './work-type.entity';

@Entity('work_logs')
export class WorkLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'section_id' })
  sectionId!: number;

  @Column({ name: 'worker_full_name' })
  workerFullName!: string;

  @Column({ name: 'work_type_id', nullable: true })
  workTypeId!: number | null;

  @Column({ name: 'custom_work_type', type: 'text', nullable: true })
  customWorkType!: string | null;

  @Column({ name: 'work_volume' })
  workVolume!: string;

  @Column({ type: 'text', default: '' })
  comment!: string;

  @Column({ name: 'photo_urls', type: 'text', default: '[]' })
  photoUrls!: string;

  @Column({ type: 'double precision', nullable: true })
  latitude!: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude!: number | null;

  @Column({ name: 'location_accuracy', type: 'double precision', nullable: true })
  locationAccuracy!: number | null;

  @Column({ name: 'location_allowed', default: false })
  locationAllowed!: boolean;

  @Index()
  @Column({ name: 'submitted_at', type: 'timestamptz', default: () => 'NOW()' })
  submittedAt!: Date;

  @Column({ name: 'task_id', nullable: true })
  taskId!: number | null;

  @Column({ name: 'review_status', type: 'varchar', length: 32, default: ReviewStatus.PENDING })
  reviewStatus!: ReviewStatus;

  @Column({ name: 'reviewed_by_id', nullable: true })
  reviewedById!: number | null;

  @Column({ name: 'review_comment', type: 'text', nullable: true })
  reviewComment!: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => Task, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'task_id' })
  task!: Task | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewedBy!: User | null;

  @ManyToOne(() => Section, (section) => section.workLogs, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'section_id' })
  section!: Section;

  @ManyToOne(() => WorkType, (workType) => workType.workLogs, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'work_type_id' })
  workType!: WorkType | null;
}
