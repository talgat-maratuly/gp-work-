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
import {
  DecisionPriority,
  DecisionStatus,
} from '../common/enums/decision.enums';
import { Task } from './task.entity';
import { User } from './user.entity';

@Entity('management_decisions')
export class ManagementDecision {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'responsible_user_id', nullable: true })
  responsibleUserId!: number | null;

  @Index()
  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate!: string | null;

  @Column({ type: 'varchar', length: 16, default: DecisionPriority.MEDIUM })
  priority!: DecisionPriority;

  @Column({ type: 'varchar', length: 24, default: DecisionStatus.OPEN })
  status!: DecisionStatus;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ name: 'linked_task_id', nullable: true })
  linkedTaskId!: number | null;

  @Column({ name: 'status_history', type: 'text', default: '[]' })
  statusHistory!: string;

  @Column({ name: 'created_by_id', nullable: true })
  createdById!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'responsible_user_id' })
  responsible!: User | null;

  @ManyToOne(() => Task, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'linked_task_id' })
  linkedTask!: Task | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User | null;
}
