import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  DeactivateProviderDto,
  ProviderParamsDto,
} from './dto/provider-params.dto';
import { ProvidersAdminService } from './providers-admin.service';

@ApiTags('Admin')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/providers')
export class ProvidersAdminController {
  constructor(private readonly providers: ProvidersAdminService) {}

  @Patch(':type/:id/deactivate')
  @ApiOperation({
    summary:
      'Deactivate a hotel or airline: hidden from search and not bookable; confirmed bookings stay valid (ACC-15)',
  })
  deactivate(
    @CurrentUser() admin: AuthUser,
    @Param() params: ProviderParamsDto,
    @Body() dto: DeactivateProviderDto,
  ) {
    return this.providers.deactivate(admin, params.type, params.id, dto.reason);
  }

  @Patch(':type/:id/reactivate')
  @ApiOperation({ summary: 'Reactivate a hotel or airline (ACC-15)' })
  reactivate(
    @CurrentUser() admin: AuthUser,
    @Param() params: ProviderParamsDto,
  ) {
    return this.providers.reactivate(admin, params.type, params.id);
  }
}
