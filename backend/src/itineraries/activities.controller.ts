import { Body, Controller, Delete, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/auth.types';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ItinerariesService } from './itineraries.service';

@ApiTags('Itinerary Activities')
@ApiCookieAuth('access_token')
@Controller('activities')
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  constructor(private readonly itinerariesService: ItinerariesService) {}

  @Patch(':id')
  updateActivity(
    @Param('id') id: string,
    @Body() dto: UpdateActivityDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.itinerariesService.updateActivity(id, dto, user.userId);
  }

  @Delete(':id')
  removeActivity(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.itinerariesService.removeActivity(id, user.userId);
  }
}
