import { detectImageExtension } from './uploads.service';

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
});
