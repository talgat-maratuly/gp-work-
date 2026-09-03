import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RouteStatus } from '../common/enums/field-execution.enums';
import { Brigade } from './brigade.entity';
import { RouteStop } from './route-stop.entity';
import { User } from './user.entity';

@Entity('routes')
export class Route {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'work_date', type: 'date' })
  workDate!: string;

  @Column({ name: 'brigade_id' })
  brigadeId!: number;

  @Column({ type: 'varchar', length: 24, default: RouteStatus.PLANNED })
  status!: RouteStatus;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ name: 'created_by_id', nullable: true })
  createdById!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Brigade, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'brigade_id' })
  brigade!: Brigade;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User | null;

  @OneToMany(() => RouteStop, (stop) => stop.route)
  stops!: RouteStop[];
}
