import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { detectImageExtension, UploadsService } from './uploads.service';

describe('upload image signature validation', () => {
  it('accepts JPEG and PNG signatures independently of file names', () => {
    expect(detectImageExtension(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe('.jpg');
    expect(detectImageExtension(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('.png');
  });

  it('accepts WebP and iPhone HEIC container signatures', () => {
    expect(detectImageExtension(Buffer.from('RIFF0000WEBP', 'ascii'))).toBe('.webp');
    expect(detectImageExtension(Buffer.from('0000ftypheic', 'ascii'))).toBe('.heic');
  });

  it('rejects executable or SVG text disguised by MIME', () => {
    expect(detectImageExtension(Buffer.from('<svg onload="alert(1)">'))).toBeNull();
    expect(detectImageExtension(Buffer.from('MZ executable'))).toBeNull();
  });

  it('validates the whole batch before writing any file', async () => {
    const root = mkdtempSync(join(tmpdir(), 'gp-work-upload-'));
    const photosDir = join(root, 'photos');
    const service = new UploadsService();
    Object.defineProperty(service, 'photosDir', { value: photosDir });
    const asFile = (buffer: Buffer) => ({ buffer } as Express.Multer.File);

    await expect(service.saveValidatedPhotos([
      asFile(Buffer.from([0xff, 0xd8, 0xff, 0xd9])),
      asFile(Buffer.from('<svg>unsafe</svg>')),
    ])).rejects.toBeInstanceOf(BadRequestException);
    expect(existsSync(photosDir)).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });
});
