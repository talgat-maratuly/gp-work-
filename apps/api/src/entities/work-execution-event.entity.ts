import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';
import { WorkExecution } from './work-execution.entity';

@Entity('work_execution_events')
export class WorkExecutionEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ name: 'client_operation_id', type: 'uuid' })
  clientOperationId!: string;

  @Index()
  @Column({ name: 'execution_id' })
  executionId!: number;

  @Column({ name: 'actor_user_id', nullable: true })
  actorUserId!: number | null;

  @Column({ type: 'varchar', length: 40 })
  type!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload!: Record<string, unknown>;

  @Column({ type: 'double precision', nullable: true })
  latitude!: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude!: number | null;

  @Column({ type: 'double precision', nullable: true })
  accuracy!: number | null;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt!: Date;

  @ManyToOne(() => WorkExecution, (execution) => execution.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'execution_id' })
  execution!: WorkExecution;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_user_id' })
  actor!: User | null;
}
