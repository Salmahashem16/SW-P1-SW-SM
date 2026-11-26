import { BadRequestException, Controller, Delete, Get, Param, Post, Req, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, createReadStream } from 'node:fs';
import { join } from 'node:path';
import type { Request, Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/auth.types';
import { ItinerariesService } from './itineraries.service';
import { ApiBody} from '@nestjs/swagger';
const imageDir = join(process.cwd(), 'uploads', 'itinerary-activities');
const formats: Record<string, string> = {'image/jpeg':'.jpg', 'image/png':'.png', 'image/webp':'.webp'};
mkdirSync(imageDir, { recursive: true });

@ApiTags('Itinerary Activity Images')
@Controller('activities')
export class ActivityImagesController {
  constructor(private readonly itinerariesService: ItinerariesService) {}

 
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiConsumes('multipart/form-data')
  @ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        format: 'binary',
      },
    },
    required: ['file'],
  },
})
 @Post(':id/images')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({ destination: imageDir, filename: (_req, file, cb) => cb(null, randomUUID() + (formats[file.mimetype] ?? '')) }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(null, Boolean(formats[file.mimetype])),
  }))
  async add(@Param('id') id: string, @UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: AuthUser) {
    if (!file) throw new BadRequestException('Upload one JPEG, PNG or WebP image (max 5 MB) using the file field');
    return this.itinerariesService.addActivityImage(id, file.filename, user.userId);
  }

  @Delete(':id/images/:imageId')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  remove(@Param('id') id: string, @Param('imageId') imageId: string, @CurrentUser() user: AuthUser) {
    return this.itinerariesService.removeActivityImage(id, imageId, user.userId);
  }

  @Get('images/:filename')
  serve(@Param('filename') filename: string, @Res({ passthrough: true }) res: Response) {
    if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(filename)) throw new BadRequestException('Invalid image filename');
    const imagePath = join(imageDir, filename);
    if (!existsSync(imagePath)) throw new BadRequestException('Image unavailable');
    const extension = filename.split('.').pop();
    res.setHeader('Content-Type', extension === 'jpg' ? 'image/jpeg' : `image/${extension}`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return new StreamableFile(createReadStream(imagePath));
  }
}
