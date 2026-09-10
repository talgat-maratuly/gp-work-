import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { FaceVerificationStatus } from '../common/enums/field-execution.enums';
import { User } from './user.entity';
import { WorkExecution } from './work-execution.entity';

@Entity('face_verifications')
export class FaceVerification {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ name: 'client_operation_id', type: 'uuid' })
  clientOperationId!: string;

  @Index()
  @Column({ name: 'execution_id' })
  executionId!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ type: 'varchar', length: 24, default: FaceVerificationStatus.PENDING })
  status!: FaceVerificationStatus;

  @Column({ name: 'selfie_url', type: 'text' })
  selfieUrl!: string;

  @Column({ name: 'liveness_evidence_urls', type: 'jsonb', default: () => "'[]'::jsonb" })
  livenessEvidenceUrls!: string[];

  @Column({ name: 'reviewed_by_id', type: 'int', nullable: true })
  reviewedById!: number | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: 'review_comment', type: 'text', nullable: true })
  reviewComment!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => WorkExecution, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'execution_id' })
  execution!: WorkExecution;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewedBy!: User | null;
}
