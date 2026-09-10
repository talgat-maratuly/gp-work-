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
  WateringShift,
  WateringStatus,
  WateringType,
} from '../common/enums/watering.enums';
import { NurseryObject } from './nursery-object.entity';
import { Section } from './section.entity';
import { User } from './user.entity';

@Entity('watering_records')
export class WateringRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: 'work_date', type: 'date' })
  workDate!: string;

  @Column({ type: 'varchar', length: 16, default: WateringShift.NIGHT })
  shift!: WateringShift;

  @Column({ type: 'varchar', length: 24, default: WateringType.AUTO })
  type!: WateringType;

  @Column({ name: 'object_id', type: 'int', nullable: true })
  objectId!: number | null;

  @Column({ name: 'section_id', type: 'int', nullable: true })
  sectionId!: number | null;

  @Column({ name: 'water_carrier_id', type: 'int', nullable: true })
  waterCarrierId!: number | null;

  @Column({ name: 'performer_name', type: 'varchar', length: 255, nullable: true })
  performerName!: string | null;

  @Column({ name: 'planned_liters', type: 'int', nullable: true })
  plannedLiters!: number | null;

  @Column({ name: 'actual_liters', type: 'int', nullable: true })
  actualLiters!: number | null;

  @Column({ name: 'start_time', type: 'varchar', length: 16, nullable: true })
  startTime!: string | null;

  @Column({ name: 'end_time', type: 'varchar', length: 16, nullable: true })
  endTime!: string | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ name: 'photo_urls', type: 'text', default: '[]' })
  photoUrls!: string;

  @Column({ type: 'double precision', nullable: true })
  latitude!: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude!: number | null;

  @Column({ name: 'qr_confirmed', type: 'boolean', default: false })
  qrConfirmed!: boolean;

  @Column({ type: 'varchar', length: 24, default: WateringStatus.PLANNED })
  status!: WateringStatus;

  @Column({ name: 'created_by_id', type: 'int', nullable: true })
  createdById!: number | null;

  @Column({ name: 'reviewed_by_id', type: 'int', nullable: true })
  reviewedById!: number | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: 'review_comment', type: 'text', nullable: true })
  reviewComment!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => NurseryObject, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'object_id' })
  object!: NurseryObject | null;

  @ManyToOne(() => Section, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'section_id' })
  section!: Section | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'water_carrier_id' })
  waterCarrier!: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewedBy!: User | null;
}
