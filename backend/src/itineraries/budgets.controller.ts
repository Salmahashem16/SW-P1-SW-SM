import { Body, Controller, Delete, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/auth.types';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { ItinerariesService } from './itineraries.service';

@ApiTags('Itinerary Budgets')
@ApiCookieAuth('access_token')
@Controller('budgets')
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(private readonly itinerariesService: ItinerariesService) {}
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBudgetDto, @CurrentUser() user: AuthUser) {
    return this.itinerariesService.updateBudget(id, dto, user.userId);
  }
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.itinerariesService.removeBudget(id, user.userId);
  }
}
