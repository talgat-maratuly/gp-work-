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
import { AttendanceStatus } from '../common/enums/attendance-status.enum';
import { WorkLog } from './work-log.entity';

@Entity('attendance_records')
@Index('UQ_attendance_date_worker', ['workDate', 'workerFullName'], { unique: true })
export class AttendanceRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'work_date', type: 'date' })
  workDate!: string;

  @Column({ name: 'worker_full_name' })
  workerFullName!: string;

  @Column({ name: 'check_in_time', type: 'timestamptz' })
  checkInTime!: Date;

  @Column({ name: 'check_out_time', type: 'timestamptz', nullable: true })
  checkOutTime!: Date | null;

  @Column({ name: 'last_activity_time', type: 'timestamptz' })
  lastActivityTime!: Date;

  @Column({ name: 'check_in_latitude', type: 'double precision', nullable: true })
  checkInLatitude!: number | null;

  @Column({ name: 'check_in_longitude', type: 'double precision', nullable: true })
  checkInLongitude!: number | null;

  @Column({ name: 'check_out_latitude', type: 'double precision', nullable: true })
  checkOutLatitude!: number | null;

  @Column({ name: 'check_out_longitude', type: 'double precision', nullable: true })
  checkOutLongitude!: number | null;

  @Column({
    name: 'worked_hours',
    type: 'decimal',
    precision: 8,
    scale: 2,
    nullable: true,
  })
  workedHours!: string | null;

  @Column({ type: 'varchar', length: 32, default: AttendanceStatus.ON_DUTY })
  status!: AttendanceStatus;

  @Column({ name: 'report_count', type: 'int', default: 1 })
  reportCount!: number;

  @Column({ name: 'first_work_log_id', nullable: true })
  firstWorkLogId!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => WorkLog, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'first_work_log_id' })
  firstWorkLog!: WorkLog | null;
}
