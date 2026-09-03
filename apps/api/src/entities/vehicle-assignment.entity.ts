import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { VehicleAssignmentStatus } from '../common/enums/resource.enums';
import { Brigade } from './brigade.entity';
import { Route } from './route.entity';
import { Task } from './task.entity';
import { User } from './user.entity';
import { Vehicle } from './vehicle.entity';
import { WorkExecution } from './work-execution.entity';

@Entity('vehicle_assignments')
export class VehicleAssignment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'vehicle_id' })
  vehicleId!: number;

  @Column({ name: 'brigade_id', nullable: true })
  brigadeId!: number | null;

  @Column({ name: 'route_id', nullable: true })
  routeId!: number | null;

  @Column({ name: 'task_id', nullable: true })
  taskId!: number | null;

  @Column({ name: 'execution_id', nullable: true })
  executionId!: number | null;

  @Column({ type: 'varchar', length: 24, default: VehicleAssignmentStatus.ASSIGNED })
  status!: VehicleAssignmentStatus;

  @Column({ name: 'assigned_by_id', nullable: true })
  assignedById!: number | null;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt!: Date;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt!: Date | null;

  @Column({ name: 'start_meter', type: 'decimal', precision: 14, scale: 1, nullable: true })
  startMeter!: string | null;

  @Column({ name: 'end_meter', type: 'decimal', precision: 14, scale: 1, nullable: true })
  endMeter!: string | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => Vehicle, (vehicle) => vehicle.assignments, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle!: Vehicle;

  @ManyToOne(() => Brigade, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'brigade_id' })
  brigade!: Brigade | null;

  @ManyToOne(() => Route, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'route_id' })
  route!: Route | null;

  @ManyToOne(() => Task, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'task_id' })
  task!: Task | null;

  @ManyToOne(() => WorkExecution, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'execution_id' })
  execution!: WorkExecution | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_by_id' })
  assignedBy!: User | null;
}
