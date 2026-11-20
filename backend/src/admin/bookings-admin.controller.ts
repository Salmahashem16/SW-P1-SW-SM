import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BookingsAdminService } from './bookings-admin.service';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';

@ApiTags('Admin')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/bookings')
export class BookingsAdminController {
  constructor(private readonly bookings: BookingsAdminService) {}

  @Get()
  @ApiOperation({
    summary:
      'Read-only list of all flight and hotel bookings, filterable by type, status and travel-date range (ACC-17)',
  })
  list(@Query() query: ListBookingsQueryDto) {
    return this.bookings.list(query);
  }
}
