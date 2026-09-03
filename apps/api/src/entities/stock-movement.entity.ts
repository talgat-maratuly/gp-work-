import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StockMovementType } from '../common/enums/stock-movement-type.enum';
import { NurseryObject } from './nursery-object.entity';
import { Product } from './product.entity';
import { Section } from './section.entity';
import { Brigade } from './brigade.entity';
import { Route } from './route.entity';
import { Task } from './task.entity';
import { User } from './user.entity';
import { WorkExecution } from './work-execution.entity';

@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'product_id', type: 'int', nullable: true })
  productId!: number | null;

  @Column({ type: 'varchar', length: 32 })
  type!: StockMovementType;

  @Column({ type: 'decimal', precision: 14, scale: 3 })
  quantity!: string;

  @Column({ name: 'created_by_id', type: 'int', nullable: true })
  createdById!: number | null;

  @Column({ name: 'worker_name', type: 'varchar', nullable: true })
  workerName!: string | null;

  @Column({ name: 'object_id', type: 'int', nullable: true })
  objectId!: number | null;

  @Column({ name: 'section_id', type: 'int', nullable: true })
  sectionId!: number | null;

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

  @Column({ name: 'client_operation_id', type: 'uuid', nullable: true, unique: true })
  clientOperationId!: string | null;

  @Column({ type: 'text', nullable: true })
  purpose!: string | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ name: 'balance_after', type: 'decimal', precision: 14, scale: 3 })
  balanceAfter!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => Product, (product) => product.movements, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'product_id' })
  product!: Product | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User | null;

  @ManyToOne(() => NurseryObject, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'object_id' })
  object!: NurseryObject | null;

  @ManyToOne(() => Section, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'section_id' })
  section!: Section | null;

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
}
