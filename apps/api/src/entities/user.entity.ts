import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';
import { Brigade } from './brigade.entity';
import { BrigadeMember } from './brigade-member.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'full_name' })
  fullName!: string;

  @Column({ unique: true })
  username!: string;

  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash!: string | null;

  @Column({ type: 'varchar', length: 32, default: UserRole.WORKER })
  role!: UserRole;

  @Column({ name: 'brigade_id', nullable: true })
  brigadeId!: number | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Brigade, (brigade) => brigade.members, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'brigade_id' })
  brigade!: Brigade | null;

  @OneToMany(() => BrigadeMember, (member) => member.user)
  brigadeMemberships!: BrigadeMember[];
}
