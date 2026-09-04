import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { open, stat, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';

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

  private storedFilename(value: string): string {
    let pathname = value;
    if (/^https?:\/\//i.test(value)) {
      let parsed: URL;
      try {
        parsed = new URL(value);
      } catch {
        throw new BadRequestException('Некорректная ссылка на фото');
      }
      const allowedOrigins = [process.env.API_PUBLIC_URL, process.env.FRONTEND_URL]
        .flatMap((entry) => (entry || '').split(','))
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          try { return new URL(entry).origin; } catch { return ''; }
        });
      if (!allowedOrigins.includes(parsed.origin)) {
        throw new BadRequestException('Фото должно быть загружено в GP Work');
      }
      pathname = parsed.pathname;
    }

    const match = pathname.match(
      /^\/uploads\/photos\/(\d{10,}-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp|heic))$/i,
    );
    if (!match) throw new BadRequestException('Фото должно быть загружено в GP Work');
    return match[1];
  }

  async assertStoredPhotoUrls(urls: string[]): Promise<void> {
    for (const url of new Set(urls)) {
      const filename = this.storedFilename(url);
      const filePath = join(this.photosDir, filename);
      try {
        const info = await stat(filePath);
        if (!info.isFile() || info.size === 0) throw new Error('empty');
        const handle = await open(filePath, 'r');
        try {
          const header = Buffer.alloc(12);
          const { bytesRead } = await handle.read(header, 0, header.length, 0);
          const detected = detectImageExtension(header.subarray(0, bytesRead));
          if (!detected || detected !== extname(filename).toLowerCase()) throw new Error('signature');
        } finally {
          await handle.close();
        }
      } catch {
        throw new BadRequestException('Загруженное фото не найдено или повреждено');
      }
    }
  }

  async saveValidatedPhotos(files: Express.Multer.File[]): Promise<string[]> {
    const extensions = files.map((file) => detectImageExtension(file.buffer));
    if (extensions.some((extension) => extension === null)) {
      throw new BadRequestException('Файл не является поддерживаемым изображением');
    }
    this.ensurePhotosDir();
    const stored: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        const filename = `${Date.now()}-${randomUUID()}${extensions[index]!}`;
        await writeFile(join(this.photosDir, filename), file.buffer, { flag: 'wx', mode: 0o640 });
        stored.push(filename);
      }
    } catch (error) {
      await Promise.all(stored.map((filename) => unlink(join(this.photosDir, filename)).catch(() => undefined)));
      throw error;
    }
    return this.toPublicUrls(stored);
  }
}
