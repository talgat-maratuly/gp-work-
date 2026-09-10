import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ExecutionStatus } from '../common/enums/field-execution.enums';
import { Brigade } from './brigade.entity';
import { RouteStop } from './route-stop.entity';
import { Section } from './section.entity';
import { Task } from './task.entity';
import { User } from './user.entity';
import { WorkExecutionEvent } from './work-execution-event.entity';
import { WorkPhoto } from './work-photo.entity';

@Entity('work_executions')
export class WorkExecution {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ name: 'client_execution_id', type: 'uuid' })
  clientExecutionId!: string;

  @Index({ unique: true })
  @Column({ name: 'task_id' })
  taskId!: number;

  @Column({ name: 'section_id' })
  sectionId!: number;

  @Column({ name: 'worker_user_id' })
  workerUserId!: number;

  @Column({ name: 'brigade_id', type: 'int', nullable: true })
  brigadeId!: number | null;

  @Column({ name: 'route_stop_id', type: 'int', nullable: true, unique: true })
  routeStopId!: number | null;

  @Column({ type: 'varchar', length: 24, default: ExecutionStatus.ASSIGNED })
  status!: ExecutionStatus;

  @Column({ name: 'qr_verified_at', type: 'timestamptz', nullable: true })
  qrVerifiedAt!: Date | null;

  @Column({ name: 'arrived_at', type: 'timestamptz', nullable: true })
  arrivedAt!: Date | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'accepted_by_id', type: 'int', nullable: true })
  acceptedById!: number | null;

  @Column({ name: 'arrival_latitude', type: 'double precision', nullable: true })
  arrivalLatitude!: number | null;

  @Column({ name: 'arrival_longitude', type: 'double precision', nullable: true })
  arrivalLongitude!: number | null;

  @Column({ name: 'arrival_accuracy', type: 'double precision', nullable: true })
  arrivalAccuracy!: number | null;

  @Column({ name: 'arrival_distance_meters', type: 'double precision', nullable: true })
  arrivalDistanceMeters!: number | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ name: 'review_comment', type: 'text', nullable: true })
  reviewComment!: string | null;

  @Column({ name: 'completion_percent', type: 'smallint', nullable: true })
  completionPercent!: number | null;

  @Column({ name: 'actual_volume', type: 'text', nullable: true })
  actualVolume!: string | null;

  @Column({ name: 'completion_description', type: 'text', nullable: true })
  completionDescription!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Task, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'task_id' })
  task!: Task;

  @ManyToOne(() => Section, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'section_id' })
  section!: Section;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'worker_user_id' })
  worker!: User;

  @ManyToOne(() => Brigade, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'brigade_id' })
  brigade!: Brigade | null;

  @ManyToOne(() => RouteStop, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'route_stop_id' })
  routeStop!: RouteStop | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'accepted_by_id' })
  acceptedBy!: User | null;

  @OneToMany(() => WorkExecutionEvent, (event) => event.execution)
  events!: WorkExecutionEvent[];

  @OneToMany(() => WorkPhoto, (photo) => photo.execution)
  photos!: WorkPhoto[];
}
