import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { PhotoAccessService } from './photo-access.service';
import { PhotoMediaController } from './photo-media.controller';

@Module({
  controllers: [UploadsController, PhotoMediaController],
  providers: [UploadsService, PhotoAccessService],
  exports: [UploadsService],
})
export class UploadsModule {}
