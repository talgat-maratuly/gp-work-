import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { ChecklistItem } from './checklist-item.entity';
import { User } from './user.entity';
import { WorkExecution } from './work-execution.entity';

@Entity('checklist_answers')
@Unique('UQ_checklist_answer_execution_item', ['executionId', 'itemId'])
export class ChecklistAnswer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: 'execution_id' })
  executionId!: number;

  @Column({ name: 'item_id' })
  itemId!: number;

  @Column({ name: 'is_completed', default: false })
  isCompleted!: boolean;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ name: 'completed_by_id', type: 'int', nullable: true })
  completedById!: number | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => WorkExecution, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'execution_id' })
  execution!: WorkExecution;

  @ManyToOne(() => ChecklistItem, (item) => item.answers, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'item_id' })
  item!: ChecklistItem;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'completed_by_id' })
  completedBy!: User | null;
}
