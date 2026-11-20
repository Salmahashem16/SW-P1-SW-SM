import { BadRequestException } from '@nestjs/common';

import { assertValidImage, detectImageKind, MAX_IMAGE_BYTES } from './image-upload';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]);
const gif = Buffer.from('GIF89a');

const file = (buffer: Buffer, size = buffer.length) => ({
  originalname: 'x',
  mimetype: 'image/png',
  size,
  buffer,
});

describe('image upload validation (GEN-08)', () => {
  it('detects JPG and PNG by content', () => {
    expect(detectImageKind(png)).toBe('png');
    expect(detectImageKind(jpg)).toBe('jpg');
    expect(detectImageKind(gif)).toBeNull();
  });

  it('rejects other formats even with an image mimetype', () => {
    expect(() => assertValidImage(file(gif))).toThrow(BadRequestException);
  });

  it('rejects files over 5 MB', () => {
    expect(() => assertValidImage(file(png, MAX_IMAGE_BYTES + 1))).toThrow(/5 MB/);
  });
});
