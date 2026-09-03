import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { WorkPhotoPhase } from '../common/enums/field-execution.enums';
import { User } from './user.entity';
import { WorkExecution } from './work-execution.entity';

@Entity('work_photos')
export class WorkPhoto {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ name: 'client_photo_id', type: 'uuid' })
  clientPhotoId!: string;

  @Index()
  @Column({ name: 'execution_id' })
  executionId!: number;

  @Column({ name: 'uploaded_by_id', nullable: true })
  uploadedById!: number | null;

  @Column({ type: 'varchar', length: 16 })
  phase!: WorkPhotoPhase;

  @Column({ type: 'text' })
  url!: string;

  @Column({ name: 'content_hash', type: 'varchar', length: 128, nullable: true })
  contentHash!: string | null;

  @Column({ name: 'captured_at', type: 'timestamptz' })
  capturedAt!: Date;

  @Column({ type: 'double precision', nullable: true })
  latitude!: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => WorkExecution, (execution) => execution.photos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'execution_id' })
  execution!: WorkExecution;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy!: User | null;
}
