import {
  BadRequestException,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Public } from '../../common/decorators/public.decorator';
import { memoryStorage } from 'multer';
import { UploadsService } from './uploads.service';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {
    this.uploadsService.ensurePhotosDir();
  }

  @Public()
  @Post('photos')
  @Throttle({ default: { limit: 20, ttl: 60_000, blockDuration: 60_000 } })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.mimetype)) {
          cb(new BadRequestException('Допустимы только изображения') as Error, false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadPhotos(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) {
      throw new BadRequestException('Загрузите хотя бы одно фото');
    }
    return this.uploadsService.saveValidatedPhotos(files);
  }
}
