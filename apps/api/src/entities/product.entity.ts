import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProductSource } from '../common/enums/product-source.enum';
import { StockMovement } from './stock-movement.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true, where: '"code" IS NOT NULL' })
  @Column({ type: 'varchar', nullable: true })
  code!: string | null;

  @Index({ unique: true, where: '"article" IS NOT NULL' })
  @Column({ type: 'varchar', nullable: true })
  article!: string | null;

  @Column()
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  unit!: string | null;

  @Column({ name: 'accounting_price', type: 'decimal', precision: 14, scale: 2, default: 0 })
  accountingPrice!: string;

  @Column({ name: 'sale_price', type: 'decimal', precision: 14, scale: 2, default: 0 })
  salePrice!: string;

  @Column({ name: 'our_price', type: 'decimal', precision: 14, scale: 2, default: 0 })
  ourPrice!: string;

  @Column({ name: 'markup_percent', type: 'decimal', precision: 8, scale: 2, nullable: true })
  markupPercent!: string | null;

  @Column({ name: 'initial_quantity', type: 'decimal', precision: 14, scale: 3, default: 0 })
  initialQuantity!: string;

  @Column({ name: 'incoming_quantity', type: 'decimal', precision: 14, scale: 3, default: 0 })
  incomingQuantity!: string;

  @Column({ name: 'outgoing_quantity', type: 'decimal', precision: 14, scale: 3, default: 0 })
  outgoingQuantity!: string;

  @Column({ name: 'current_quantity', type: 'decimal', precision: 14, scale: 3, default: 0 })
  currentQuantity!: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalAmount!: string;

  @Column({ name: 'external_id_1c', type: 'varchar', nullable: true })
  externalId1C!: string | null;

  @Column({ name: 'code_1c', type: 'varchar', nullable: true })
  code1C!: string | null;

  @Column({ type: 'varchar', length: 16, default: ProductSource.MANUAL })
  source!: ProductSource;

  @Column({ name: 'last_sync_at', type: 'timestamptz', nullable: true })
  lastSyncAt!: Date | null;

  @Column({ name: 'is_actual', default: true })
  isActual!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => StockMovement, (movement) => movement.product)
  movements!: StockMovement[];
}
