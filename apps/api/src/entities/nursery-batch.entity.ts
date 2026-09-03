import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { NurseryBatchStatus } from '../common/enums/resource.enums';
import { NurseryMovement } from './nursery-movement.entity';

@Entity('nursery_batches')
export class NurseryBatch {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ name: 'batch_code', type: 'varchar', length: 80 })
  batchCode!: string;

  @Column({ type: 'varchar', length: 160 })
  culture!: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  variety!: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 3 })
  quantity!: string;

  @Column({ name: 'reserved_quantity', type: 'decimal', precision: 14, scale: 3, default: 0 })
  reservedQuantity!: string;

  @Column({ type: 'varchar', length: 32, default: 'шт' })
  unit!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  size!: string | null;

  @Column({ name: 'age_months', type: 'int', nullable: true })
  ageMonths!: number | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  location!: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  condition!: string | null;

  @Column({ type: 'varchar', length: 24, default: NurseryBatchStatus.AVAILABLE })
  status!: NurseryBatchStatus;

  @Column({ name: 'received_at', type: 'date', nullable: true })
  receivedAt!: string | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => NurseryMovement, (movement) => movement.batch)
  movements!: NurseryMovement[];
}
