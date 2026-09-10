import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { NurseryMovementType } from '../common/enums/resource.enums';
import { Brigade } from './brigade.entity';
import { NurseryBatch } from './nursery-batch.entity';
import { NurseryObject } from './nursery-object.entity';
import { Route } from './route.entity';
import { Task } from './task.entity';
import { User } from './user.entity';
import { WorkExecution } from './work-execution.entity';

@Entity('nursery_movements')
export class NurseryMovement {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'batch_id' })
  batchId!: number;

  @Column({ type: 'varchar', length: 24 })
  type!: NurseryMovementType;

  @Column({ type: 'decimal', precision: 14, scale: 3 })
  quantity!: string;

  @Column({ name: 'balance_after', type: 'decimal', precision: 14, scale: 3 })
  balanceAfter!: string;

  @Column({ name: 'from_location', type: 'varchar', length: 180, nullable: true })
  fromLocation!: string | null;

  @Column({ name: 'to_location', type: 'varchar', length: 180, nullable: true })
  toLocation!: string | null;

  @Column({ name: 'object_id', type: 'int', nullable: true })
  objectId!: number | null;

  @Column({ name: 'task_id', type: 'int', nullable: true })
  taskId!: number | null;

  @Column({ name: 'brigade_id', type: 'int', nullable: true })
  brigadeId!: number | null;

  @Column({ name: 'employee_id', type: 'int', nullable: true })
  employeeId!: number | null;

  @Column({ name: 'route_id', type: 'int', nullable: true })
  routeId!: number | null;

  @Column({ name: 'execution_id', type: 'int', nullable: true })
  executionId!: number | null;

  @Column({ name: 'created_by_id', type: 'int', nullable: true })
  createdById!: number | null;

  @Column({ name: 'client_operation_id', type: 'uuid', nullable: true, unique: true })
  clientOperationId!: string | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => NurseryBatch, (batch) => batch.movements, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'batch_id' })
  batch!: NurseryBatch;

  @ManyToOne(() => NurseryObject, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'object_id' })
  object!: NurseryObject | null;

  @ManyToOne(() => Task, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'task_id' })
  task!: Task | null;

  @ManyToOne(() => Brigade, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'brigade_id' })
  brigade!: Brigade | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'employee_id' })
  employee!: User | null;

  @ManyToOne(() => Route, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'route_id' })
  route!: Route | null;

  @ManyToOne(() => WorkExecution, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'execution_id' })
  execution!: WorkExecution | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User | null;
}
