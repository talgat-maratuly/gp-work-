import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BrigadeMember } from '../../entities/brigade-member.entity';
import { Brigade } from '../../entities/brigade.entity';
import { User } from '../../entities/user.entity';
import { BrigadesController } from './brigades.controller';
import { BrigadesService } from './brigades.service';

@Module({
  imports: [TypeOrmModule.forFeature([Brigade, BrigadeMember, User])],
  controllers: [BrigadesController],
  providers: [BrigadesService],
  exports: [BrigadesService],
})
export class BrigadesModule {}
