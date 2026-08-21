import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

@Injectable()
export class UploadsService {
  readonly photosDir = join(process.cwd(), 'uploads', 'photos');

  ensurePhotosDir() {
    if (!existsSync(this.photosDir)) {
      mkdirSync(this.photosDir, { recursive: true });
    }
  }

  toPublicUrls(filenames: string[]): string[] {
    return filenames.map((name) => `/uploads/photos/${name}`);
  }
}
