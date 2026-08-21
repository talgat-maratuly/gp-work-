import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('section_code_counter')
export class SectionCodeCounter {
  @PrimaryColumn({ default: 1 })
  id!: number;

  @Column({ default: 0 })
  value!: number;
}
