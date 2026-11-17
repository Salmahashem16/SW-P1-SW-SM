import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import {
  ContentParamsDto,
  ReportIdParamsDto,
} from './dto/moderation-params.dto';
import { ModerationNoteDto, ResolveReportDto } from './dto/resolve-report.dto';
import { ReportsService } from './reports.service';

/** GEN-10: lives under /api/admin next to the other admin routes. */
@ApiTags('Admin')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class ModerationAdminController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('reports')
  @ApiOperation({
    summary:
      'List reports (open by default) with a preview of the content (GEN-09, GEN-10)',
  })
  listReports(@Query() query: ListReportsQueryDto) {
    return this.reportsService.listForAdmin(query);
  }

  @Patch('reports/:id')
  @ApiOperation({
    summary: 'Resolve a report: dismiss, hide or delete the content (GEN-10)',
  })
  resolveReport(
    @CurrentUser() admin: AuthUser,
    @Param() params: ReportIdParamsDto,
    @Body() dto: ResolveReportDto,
  ) {
    return this.reportsService.resolve(admin, params.id, dto.action, dto.note);
  }

  @Patch('content/:type/:id/hide')
  @ApiOperation({
    summary:
      'Hide a post, comment, review or itinerary directly; only its author and admins can still see it (GEN-10)',
  })
  hideContent(
    @CurrentUser() admin: AuthUser,
    @Param() params: ContentParamsDto,
    @Body() dto: ModerationNoteDto,
  ) {
    return this.reportsService.hideContent(
      admin,
      params.type,
      params.id,
      dto.note,
    );
  }

  @Patch('content/:type/:id/unhide')
  @ApiOperation({ summary: 'Make hidden content visible again (GEN-10)' })
  unhideContent(
    @CurrentUser() admin: AuthUser,
    @Param() params: ContentParamsDto,
    @Body() dto: ModerationNoteDto,
  ) {
    return this.reportsService.unhideContent(
      admin,
      params.type,
      params.id,
      dto.note,
    );
  }

  @Delete('content/:type/:id')
  @ApiOperation({
    summary: 'Delete a post, comment, review or itinerary directly (GEN-10)',
  })
  deleteContent(
    @CurrentUser() admin: AuthUser,
    @Param() params: ContentParamsDto,
  ) {
    return this.reportsService.deleteContent(admin, params.type, params.id);
  }
}
