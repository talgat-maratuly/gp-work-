import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { WorkType } from './work-type.entity';
import { ChecklistAnswer } from './checklist-answer.entity';

@Entity('checklist_items')
export class ChecklistItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: 'work_type_id', type: 'int', nullable: true })
  workTypeId!: number | null;

  @Column({ type: 'text' })
  label!: string;

  @Column({ name: 'is_required', default: true })
  isRequired!: boolean;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => WorkType, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_type_id' })
  workType!: WorkType | null;

  @OneToMany(() => ChecklistAnswer, (answer) => answer.item)
  answers!: ChecklistAnswer[];
}
