import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { RouteStopStatus } from '../common/enums/field-execution.enums';
import { Route } from './route.entity';
import { Section } from './section.entity';
import { Task } from './task.entity';

@Entity('route_stops')
@Unique('UQ_route_stop_position', ['routeId', 'position'])
export class RouteStop {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: 'route_id' })
  routeId!: number;

  @Index()
  @Column({ name: 'task_id' })
  taskId!: number;

  @Column({ name: 'section_id' })
  sectionId!: number;

  @Column({ type: 'int' })
  position!: number;

  @Column({ name: 'planned_arrival_at', type: 'timestamptz', nullable: true })
  plannedArrivalAt!: Date | null;

  @Column({ type: 'varchar', length: 24, default: RouteStopStatus.PLANNED })
  status!: RouteStopStatus;

  @Column({ name: 'arrived_at', type: 'timestamptz', nullable: true })
  arrivedAt!: Date | null;

  @Column({ name: 'arrival_latitude', type: 'double precision', nullable: true })
  arrivalLatitude!: number | null;

  @Column({ name: 'arrival_longitude', type: 'double precision', nullable: true })
  arrivalLongitude!: number | null;

  @Column({ name: 'arrival_accuracy', type: 'double precision', nullable: true })
  arrivalAccuracy!: number | null;

  @Column({ name: 'distance_meters', type: 'double precision', nullable: true })
  distanceMeters!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Route, (route) => route.stops, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' })
  route!: Route;

  @ManyToOne(() => Task, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'task_id' })
  task!: Task;

  @ManyToOne(() => Section, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'section_id' })
  section!: Section;
}
