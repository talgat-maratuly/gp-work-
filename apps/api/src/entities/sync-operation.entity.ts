import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { SyncOperationStatus } from '../common/enums/field-execution.enums';
import { User } from './user.entity';

@Entity('sync_operations')
export class SyncOperation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ name: 'client_operation_id', type: 'uuid' })
  clientOperationId!: string;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId!: number | null;

  @Column({ type: 'varchar', length: 48 })
  type!: string;

  @Column({ name: 'payload_hash', type: 'varchar', length: 128 })
  payloadHash!: string;

  @Column({ type: 'varchar', length: 24, default: SyncOperationStatus.PROCESSING })
  status!: SyncOperationStatus;

  @Column({ name: 'resource_type', type: 'varchar', length: 48, nullable: true })
  resourceType!: string | null;

  @Column({ name: 'resource_id', type: 'varchar', length: 64, nullable: true })
  resourceId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  response!: Record<string, unknown> | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;
}
