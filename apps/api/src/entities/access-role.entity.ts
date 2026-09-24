import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';

@Entity('access_roles')
export class AccessRole {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ length: 100, unique: true }) name!: string;
  @Column({ name: 'base_role', length: 32 }) baseRole!: UserRole;
  @Column({ name: 'system_key', length: 32, nullable: true, unique: true }) systemKey!: UserRole | null;
  // Null preserves the exact legacy policy for system roles.
  @Column({ type: 'jsonb', nullable: true }) permissions!: string[] | null;
  @Column({ type: 'jsonb', default: '[]' }) pages!: string[];
  @Column({ name: 'can_join_brigade', default: false }) canJoinBrigade!: boolean;
  @Column({ name: 'is_active', default: true }) isActive!: boolean;
  @Column({ default: 1 }) revision!: number;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}
