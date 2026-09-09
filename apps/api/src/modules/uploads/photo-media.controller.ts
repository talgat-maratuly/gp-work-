import { Controller, Get, Header, NotFoundException, Param, StreamableFile } from '@nestjs/common';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { join, extname } from 'path';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities';
import { PhotoAccessService } from './photo-access.service';
import { UploadsService } from './uploads.service';

@Controller('uploads/photos')
export class PhotoMediaController {
  constructor(private readonly access: PhotoAccessService, private readonly uploads: UploadsService) {}

  @Get(':filename')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('X-Content-Type-Options', 'nosniff')
  async read(@Param('filename') filename: string, @CurrentUser() user: User) {
    // Permit historical safe filenames, but never directories or arbitrary files.
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}\.(jpg|jpeg|png|webp|heic|heif)$/i.test(filename)) {
      throw new NotFoundException('Фото недоступно');
    }
    await this.access.assertCanRead(filename, user);
    const path = join(this.uploads.photosDir, filename);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) throw new NotFoundException('Фото недоступно');
    const types: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif' };
    return new StreamableFile(createReadStream(path), { type: types[extname(filename).toLowerCase()], length: info.size, disposition: 'inline' });
  }
}
