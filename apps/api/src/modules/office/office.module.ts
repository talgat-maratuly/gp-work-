import { Module } from '@nestjs/common';
import { OfficeController, OfficeAccessController } from './office.controller';
import { OfficeService } from './office.service';
@Module({controllers:[OfficeController,OfficeAccessController],providers:[OfficeService]})
export class OfficeModule {}
