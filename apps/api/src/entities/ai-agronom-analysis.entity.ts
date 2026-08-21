import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AiPlantStatus } from '../common/enums/ai-plant-status.enum';
import { NurseryObject } from './nursery-object.entity';
import { Section } from './section.entity';
import { User } from './user.entity';

@Entity('ai_agronom_analyses')
export class AiAgronomAnalysis {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'created_by_id', nullable: true })
  createdById!: number | null;

  @Column({ name: 'object_id' })
  objectId!: number;

  @Column({ name: 'section_id', nullable: true })
  sectionId!: number | null;

  @Column({ type: 'varchar', nullable: true })
  culture!: string | null;

  @Column({ name: 'photo_url', type: 'text' })
  photoUrl!: string;

  @Column({ type: 'varchar', length: 32 })
  status!: AiPlantStatus;

  @Column({ type: 'int' })
  confidence!: number;

  @Column({ name: 'health_percent', type: 'int', default: 0 })
  healthPercent!: number;

  @Column({ name: 'drought_signs', default: false })
  droughtSigns!: boolean;

  @Column({ name: 'burn_signs', default: false })
  burnSigns!: boolean;

  @Column({ name: 'weeds_present', default: false })
  weedsPresent!: boolean;

  @Column({ name: 'disease_signs', default: false })
  diseaseSigns!: boolean;

  @Column({ name: 'pest_signs', default: false })
  pestSigns!: boolean;

  @Column({ name: 'yellowing_leaves', default: false })
  yellowingLeaves!: boolean;

  @Column({ name: 'nutrition_deficiency', default: false })
  nutritionDeficiency!: boolean;

  @Column({ name: 'mechanical_damage', default: false })
  mechanicalDamage!: boolean;

  @Column({ name: 'fire_damage', default: false })
  fireDamage!: boolean;

  @Column({ name: 'severe_drying', default: false })
  severeDrying!: boolean;

  @Column({ name: 'mass_die_off', default: false })
  massDieOff!: boolean;

  @Column({ name: 'growth_stage', type: 'varchar', nullable: true })
  growthStage!: string | null;

  @Column({ name: 'ai_comment', type: 'text' })
  aiComment!: string;

  @Column({ name: 'recommendations', type: 'text', default: '[]' })
  recommendations!: string;

  @Column({ name: 'agronomist_comment', type: 'text', nullable: true })
  agronomistComment!: string | null;

  @Column({ name: 'model_name', type: 'varchar', nullable: true })
  modelName!: string | null;

  @Column({ name: 'raw_model_response', type: 'text', nullable: true })
  rawModelResponse!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User | null;

  @ManyToOne(() => NurseryObject, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'object_id' })
  object!: NurseryObject;

  @ManyToOne(() => Section, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'section_id' })
  section!: Section | null;
}
