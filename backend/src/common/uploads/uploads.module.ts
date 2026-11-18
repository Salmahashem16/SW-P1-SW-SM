import { Module } from '@nestjs/common';

import { ImageStorageService } from './image-storage.service';
import { UploadsController } from './uploads.controller';

/**
 * GEN-08 shared image uploads. Import this module where you need
 * ImageStorageService (hotels already does, so GET /api/uploads/:filename is
 * registered).
 */
@Module({
  controllers: [UploadsController],
  providers: [ImageStorageService],
  exports: [ImageStorageService],
})
export class UploadsModule {}
