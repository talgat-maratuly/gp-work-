import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { Brigade } from '../../entities/brigade.entity';
import { BrigadeMember } from '../../entities/brigade-member.entity';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JobPosition } from '../../entities/job-position.entity';
import { JobPositionsController } from './job-positions.controller';
import { JobPositionsService } from './job-positions.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Brigade, BrigadeMember, JobPosition]), AuthModule],
  controllers: [UsersController, JobPositionsController],
  providers: [UsersService, JobPositionsService],
  exports: [UsersService],
})
export class UsersModule {}
