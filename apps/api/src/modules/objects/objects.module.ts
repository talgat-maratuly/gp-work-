import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NurseryObject } from '../../entities/nursery-object.entity';
import { Section } from '../../entities/section.entity';
import { ObjectsController } from './objects.controller';
import { ObjectsService } from './objects.service';

@Module({
  imports: [TypeOrmModule.forFeature([NurseryObject, Section])],
  controllers: [ObjectsController],
  providers: [ObjectsService],
  exports: [ObjectsService],
})
export class ObjectsModule {}
