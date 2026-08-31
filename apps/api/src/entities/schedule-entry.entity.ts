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
import { ScheduleStatus } from '../common/enums/schedule-status.enum';
import { Brigade } from './brigade.entity';
import { NurseryObject } from './nursery-object.entity';
import { Section } from './section.entity';
import { Task } from './task.entity';
import { User } from './user.entity';
import { WorkType } from './work-type.entity';

@Entity('schedule_entries')
export class ScheduleEntry {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: 'planned_date', type: 'date' })
  plannedDate!: string;

  @Column({ name: 'object_id', nullable: true })
  objectId!: number | null;

  @Column({ name: 'section_id', nullable: true })
  sectionId!: number | null;

  @Column({ name: 'work_type_id', nullable: true })
  workTypeId!: number | null;

  @Column({ name: 'brigade_id', nullable: true })
  brigadeId!: number | null;

  @Column({ name: 'assignee_user_id', nullable: true })
  assigneeUserId!: number | null;

  @Column({ name: 'task_id', nullable: true })
  taskId!: number | null;

  @Column({ type: 'varchar', length: 24, default: ScheduleStatus.PLANNED })
  status!: ScheduleStatus;

  @Column({ name: 'reschedule_reason', type: 'text', nullable: true })
  rescheduleReason!: string | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ name: 'status_history', type: 'text', default: '[]' })
  statusHistory!: string;

  @Column({ name: 'created_by_id', nullable: true })
  createdById!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => NurseryObject, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'object_id' })
  object!: NurseryObject | null;

  @ManyToOne(() => Section, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'section_id' })
  section!: Section | null;

  @ManyToOne(() => WorkType, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'work_type_id' })
  workType!: WorkType | null;

  @ManyToOne(() => Brigade, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'brigade_id' })
  brigade!: Brigade | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignee_user_id' })
  assignee!: User | null;

  @ManyToOne(() => Task, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'task_id' })
  task!: Task | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User | null;
}
