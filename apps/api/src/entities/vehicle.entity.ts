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
import { VehicleStatus, VehicleType } from '../common/enums/resource.enums';
import { User } from './user.entity';
import { VehicleAssignment } from './vehicle-assignment.entity';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 32 })
  type!: VehicleType;

  @Column({ type: 'varchar', length: 24, default: VehicleStatus.FREE })
  status!: VehicleStatus;

  @Column({ name: 'registration_number', type: 'varchar', length: 64, nullable: true })
  registrationNumber!: string | null;

  @Column({ name: 'responsible_user_id', nullable: true })
  responsibleUserId!: number | null;

  @Column({ type: 'decimal', precision: 14, scale: 1, nullable: true })
  odometer!: string | null;

  @Column({ name: 'engine_hours', type: 'decimal', precision: 14, scale: 1, nullable: true })
  engineHours!: string | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'responsible_user_id' })
  responsibleUser!: User | null;

  @OneToMany(() => VehicleAssignment, (assignment) => assignment.vehicle)
  assignments!: VehicleAssignment[];
}
