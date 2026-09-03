import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TaskCategory } from '../common/enums/task-category.enum';
import { TaskPriority } from '../common/enums/task-priority.enum';
import { TaskStatus } from '../common/enums/task-status.enum';
import { Brigade } from './brigade.entity';
import { Section } from './section.entity';
import { User } from './user.entity';
import { WorkType } from './work-type.entity';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'section_id' })
  sectionId!: number;

  @Column({ name: 'work_type_id', type: 'int', nullable: true })
  workTypeId!: number | null;

  @Column({ name: 'assignee_user_id', type: 'int', nullable: true })
  assigneeUserId!: number | null;

  @Column({ name: 'brigade_id', type: 'int', nullable: true })
  brigadeId!: number | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate!: string | null;

  @Column({ type: 'varchar', length: 16, default: TaskPriority.MEDIUM })
  priority!: TaskPriority;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'varchar', length: 32, default: TaskStatus.ASSIGNED })
  status!: TaskStatus;

  @Column({ type: 'varchar', length: 16, default: TaskCategory.WORK })
  category!: TaskCategory;

  @Column({ name: 'created_by_id', type: 'int', nullable: true })
  createdById!: number | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'completion_photo_urls', type: 'text', default: '[]' })
  completionPhotoUrls!: string;

  @Column({ name: 'completion_comment', type: 'text', nullable: true })
  completionComment!: string | null;

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

  @ManyToOne(() => Section, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section!: Section;

  @ManyToOne(() => WorkType, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'work_type_id' })
  workType!: WorkType | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignee_user_id' })
  assignee!: User | null;

  @ManyToOne(() => Brigade, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'brigade_id' })
  brigade!: Brigade | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewedBy!: User | null;
}
