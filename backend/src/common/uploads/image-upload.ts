import { BadRequestException } from '@nestjs/common';

/**
 * GEN-08: JPG or PNG, up to 5 MB each, up to 5 images per post, activity or
 * hotel, and 1 logo per airline. Stored on the server and served by URL.
 *
 * Usage in a controller (ITN-12 and BLG-10 can reuse this as-is):
 *
 *   @Post(':id/images')
 *   @UseInterceptors(FilesInterceptor('images', MAX_IMAGES_PER_ITEM, imageUploadOptions))
 *   @ApiConsumes('multipart/form-data')
 *   @ApiBody(imagesApiBody('images'))
 *   upload(@UploadedFiles() files: UploadedImage[]) {
 *     const saved = await this.imageStorage.saveAll(files);  // validates + writes
 *   }
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_ITEM = 5;

/** The fields we use from a multer file (memory storage). */
export interface UploadedImage {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Multer options: keep files in memory so content can be checked before saving. */
export const imageUploadOptions = {
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_IMAGES_PER_ITEM },
};

export type ImageKind = 'jpg' | 'png';

/** Detects the real format from the file's first bytes, not its name. */
export function detectImageKind(buffer: Buffer): ImageKind | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'jpg';
  }

  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length >= png.length && png.every((b, i) => buffer[i] === b)) {
    return 'png';
  }

  return null;
}

export function assertValidImage(file: UploadedImage): ImageKind {
  if (file.size > MAX_IMAGE_BYTES || file.buffer.length > MAX_IMAGE_BYTES) {
    throw new BadRequestException(`${file.originalname} is larger than 5 MB`);
  }

  const kind = detectImageKind(file.buffer);
  if (!kind) {
    throw new BadRequestException(
      `${file.originalname} must be a JPG or PNG image`,
    );
  }

  return kind;
}

/** Swagger body for a multi-file upload field. */
export function imagesApiBody(field: string) {
  return {
    schema: {
      type: 'object',
      required: [field],
      properties: {
        [field]: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'JPG or PNG, max 5 MB each, max 5 per item',
        },
      },
    },
  };
}
