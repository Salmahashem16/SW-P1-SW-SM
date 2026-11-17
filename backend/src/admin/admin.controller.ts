import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';
import { CreateModeratorDto } from './dto/create-moderator.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { SuspendAccountDto } from './dto/suspend-account.dto';

@ApiTags('Admin')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('moderators')
  @ApiOperation({
    summary: 'Create a hotel or airline moderator account (ACC-13)',
  })
  createModerator(
    @CurrentUser() admin: AuthUser,
    @Body() dto: CreateModeratorDto,
  ) {
    return this.adminService.createModerator(admin, dto);
  }

  @Get('accounts')
  @ApiOperation({
    summary: 'List accounts with search and role/status filters (ACC-14)',
  })
  listAccounts(@Query() query: ListAccountsQueryDto) {
    return this.adminService.listAccounts(query);
  }

  @Patch('accounts/:id/suspend')
  @ApiOperation({
    summary: 'Suspend a moderator or registered user (ACC-15, ACC-16)',
  })
  suspendAccount(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body() dto: SuspendAccountDto,
  ) {
    return this.adminService.suspendAccount(admin, id, dto.reason);
  }

  @Patch('accounts/:id/reactivate')
  @ApiOperation({
    summary: 'Reactivate a suspended account (ACC-15, ACC-16)',
  })
  reactivateAccount(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
  ) {
    return this.adminService.reactivateAccount(admin, id);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'View the admin audit log (GEN-07)' })
  listAuditLogs(@Query() query: ListAuditLogsQueryDto) {
    return this.adminService.listAuditLogs(query);
  }
}
