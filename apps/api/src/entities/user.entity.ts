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
import { JobPosition } from './job-position.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'full_name' })
  fullName!: string;

  @Column({ unique: true })
  username!: string;

  @Column({ name: 'password_hash', type: 'text', nullable: true, select: false })
  passwordHash!: string | null;

  // Credential state is loaded explicitly so an unrelated profile save cannot
  // restore a stale version or cancel a password reset in another request.
  @Column({ name: 'auth_version', type: 'int', default: 0, select: false })
  authVersion!: number;

  @Column({ name: 'must_change_password', default: false, select: false })
  mustChangePassword!: boolean;

  @Column({ name: 'password_reset_at', type: 'timestamptz', nullable: true, select: false })
  passwordResetAt!: Date | null;

  @Column({ name: 'password_reset_expires_at', type: 'timestamptz', nullable: true, select: false })
  passwordResetExpiresAt!: Date | null;

  @Column({ name: 'password_reset_by_id', type: 'int', nullable: true, select: false })
  passwordResetById!: number | null;

  @Column({ type: 'varchar', length: 32, default: UserRole.WORKER })
  role!: UserRole;

  @Column({ name: 'position_id', type: 'int', nullable: true })
  positionId!: number | null;

  @ManyToOne(() => JobPosition, { nullable: true, eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'position_id' })
  position!: JobPosition | null;

  @Column({ name: 'brigade_id', type: 'int', nullable: true })
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
