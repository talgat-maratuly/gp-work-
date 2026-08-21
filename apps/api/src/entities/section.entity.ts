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
import { NurseryObject } from './nursery-object.entity';
import { WorkLog } from './work-log.entity';

@Entity('sections')
export class Section {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'object_id' })
  objectId!: number;

  @Column({ unique: true })
  code!: string;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  area!: string | null;

  @Column({ type: 'text', nullable: true })
  culture!: string | null;

  @Column({ name: 'custom_text', type: 'text', nullable: true })
  customText!: string | null;

  @Column({ name: 'qr_code_url', type: 'text', nullable: true })
  qrCodeUrl!: string | null;

  @Column({ name: 'form_url', type: 'text', nullable: true })
  formUrl!: string | null;

  @Column({ type: 'double precision', nullable: true })
  latitude!: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude!: number | null;

  @Column({ name: 'radius_meters', type: 'int', nullable: true })
  radiusMeters!: number | null;

  @Column({ name: 'care_status', type: 'varchar', length: 64, nullable: true })
  careStatus!: string | null;

  @Column({ name: 'care_problems', type: 'text', default: '[]' })
  careProblems!: string;

  @Column({ name: 'care_recommendation', type: 'text', nullable: true })
  careRecommendation!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => NurseryObject, (object) => object.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'object_id' })
  object!: NurseryObject;

  @OneToMany(() => WorkLog, (workLog) => workLog.section)
  workLogs!: WorkLog[];
}
