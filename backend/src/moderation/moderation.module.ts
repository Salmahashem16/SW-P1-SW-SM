import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ContentModerationService } from './content-moderation.service';
import { ModerationAdminController } from './moderation-admin.controller';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Report, ReportSchema } from './schemas/report.schema';

/**
 * GEN-09 / GEN-10. Import this module where you need
 * ContentModerationService (e.g. to register a delete handler).
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Report.name, schema: ReportSchema }]),
    AuditLogsModule,
  ],
  controllers: [ReportsController, ModerationAdminController],
  providers: [ReportsService, ContentModerationService],
  exports: [ContentModerationService],
})
export class ModerationModule {}
