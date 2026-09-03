import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export function detectImageExtension(buffer: Buffer): '.jpg' | '.png' | '.webp' | '.heic' | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return '.webp';
  const brand = buffer.length >= 12 ? buffer.subarray(4, 12).toString('ascii') : '';
  if (/^ftyp(heic|heix|hevc|hevx|mif1|msf1)$/.test(brand)) return '.heic';
  return null;
}

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

  async saveValidatedPhotos(files: Express.Multer.File[]): Promise<string[]> {
    this.ensurePhotosDir();
    const stored: string[] = [];
    for (const file of files) {
      const extension = detectImageExtension(file.buffer);
      if (!extension) throw new BadRequestException('Файл не является поддерживаемым изображением');
      const filename = `${Date.now()}-${randomUUID()}${extension}`;
      await writeFile(join(this.photosDir, filename), file.buffer, { flag: 'wx', mode: 0o640 });
      stored.push(filename);
    }
    return this.toPublicUrls(stored);
  }
}
