import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { STORED_FILENAME, uploadDir } from './image-storage.service';

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  @Get(':filename')
  @ApiOperation({ summary: 'Serve an uploaded image (GEN-08)' })
  serve(@Param('filename') filename: string, @Res() res: Response) {
    // Only names we generated, so no path traversal is possible.
    if (!STORED_FILENAME.test(filename)) {
      throw new NotFoundException('Image not found');
    }

    const path = join(uploadDir(), filename);
    if (!existsSync(path)) {
      throw new NotFoundException('Image not found');
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.sendFile(path);
  }
}
