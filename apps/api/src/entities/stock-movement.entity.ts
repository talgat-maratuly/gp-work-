import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StockMovementType } from '../common/enums/stock-movement-type.enum';
import { NurseryObject } from './nursery-object.entity';
import { Product } from './product.entity';
import { Section } from './section.entity';
import { User } from './user.entity';

@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'product_id', nullable: true })
  productId!: number | null;

  @Column({ type: 'varchar', length: 32 })
  type!: StockMovementType;

  @Column({ type: 'decimal', precision: 14, scale: 3 })
  quantity!: string;

  @Column({ name: 'created_by_id', nullable: true })
  createdById!: number | null;

  @Column({ name: 'worker_name', type: 'varchar', nullable: true })
  workerName!: string | null;

  @Column({ name: 'object_id', nullable: true })
  objectId!: number | null;

  @Column({ name: 'section_id', nullable: true })
  sectionId!: number | null;

  @Column({ type: 'text', nullable: true })
  purpose!: string | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ name: 'balance_after', type: 'decimal', precision: 14, scale: 3 })
  balanceAfter!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => Product, (product) => product.movements, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'product_id' })
  product!: Product | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User | null;

  @ManyToOne(() => NurseryObject, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'object_id' })
  object!: NurseryObject | null;

  @ManyToOne(() => Section, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'section_id' })
  section!: Section | null;
}
