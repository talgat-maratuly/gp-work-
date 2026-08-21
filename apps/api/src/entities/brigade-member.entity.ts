import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Brigade } from './brigade.entity';
import { User } from './user.entity';

@Entity('brigade_members')
@Unique(['brigadeId', 'userId'])
export class BrigadeMember {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'brigade_id' })
  brigadeId!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @CreateDateColumn({ name: 'joined_at', type: 'timestamptz' })
  joinedAt!: Date;

  @ManyToOne(() => Brigade, (brigade) => brigade.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brigade_id' })
  brigade!: Brigade;

  @ManyToOne(() => User, (user) => user.brigadeMemberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
