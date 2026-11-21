import { Body, Controller, Delete, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/auth.types';
import { UpdateTransportCostDto } from './dto/update-transport-cost.dto';
import { ItinerariesService } from './itineraries.service';

@ApiTags('Itinerary Transport Costs')
@ApiCookieAuth('access_token')
@Controller('transport-costs')
@UseGuards(JwtAuthGuard)
export class TransportCostsController {
  constructor(private readonly itinerariesService: ItinerariesService) {}
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTransportCostDto, @CurrentUser() user: AuthUser) {
    return this.itinerariesService.updateTransportCost(id, dto, user.userId);
  }
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.itinerariesService.removeTransportCost(id, user.userId);
  }
}
