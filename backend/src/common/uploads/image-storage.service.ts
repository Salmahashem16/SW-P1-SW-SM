import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { assertValidImage } from './image-upload';
import type { UploadedImage } from './image-upload';

export interface StoredImage {
  filename: string;
  url: string;
}

/** Filenames we generate: uuid + extension. Anything else is never served. */
export const STORED_FILENAME = /^[0-9a-f-]{36}\.(jpg|png)$/;

export function uploadDir(): string {
  return process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
}

/** GEN-08: stores validated images on the server's disk. */
@Injectable()
export class ImageStorageService {
  private readonly logger = new Logger(ImageStorageService.name);

  /** Validates every file first, so nothing is written if one is invalid. */
  async saveAll(files: UploadedImage[] | undefined): Promise<StoredImage[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one image is required');
    }

    const kinds = files.map((file) => assertValidImage(file));
    const dir = uploadDir();
    await mkdir(dir, { recursive: true });

    const saved: StoredImage[] = [];
    try {
      for (const [i, file] of files.entries()) {
        const filename = `${randomUUID()}.${kinds[i]}`;
        await writeFile(join(dir, filename), file.buffer);
        saved.push({ filename, url: `/api/uploads/${filename}` });
      }
    } catch (error) {
      await this.removeAll(saved.map((s) => s.filename));
      throw error;
    }

    return saved;
  }

  async removeAll(filenames: string[]): Promise<void> {
    await Promise.all(filenames.map((name) => this.remove(name)));
  }

  /** Best effort: a missing file is not an error. */
  async remove(filename: string): Promise<void> {
    if (!STORED_FILENAME.test(filename)) {
      return;
    }

    try {
      await unlink(join(uploadDir(), filename));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Could not delete ${filename}: ${String(error)}`);
      }
    }
  }
}
