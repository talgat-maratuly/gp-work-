import {
  BadRequestException,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Public } from '../../common/decorators/public.decorator';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { UploadsService } from './uploads.service';

const PHOTOS_DIR = join(process.cwd(), 'uploads', 'photos');

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {
    this.uploadsService.ensurePhotosDir();
  }

  @Public()
  @Post('photos')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, PHOTOS_DIR);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname) || '.jpg';
          cb(null, `${Date.now()}-${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Допустимы только изображения') as Error, false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadPhotos(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) {
      throw new BadRequestException('Загрузите хотя бы одно фото');
    }
    return this.uploadsService.toPublicUrls(files.map((f) => f.filename));
  }
}
