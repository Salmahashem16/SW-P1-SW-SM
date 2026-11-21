import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/auth.types';
import { AddDayDto } from './dto/add-day.dto';
import { CreateActivityDto } from './dto/create-activity.dto';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { ReorderDaysDto } from './dto/reorder-days.dto';
import { UpdateDayDto } from './dto/update-day.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import { ItinerariesService } from './itineraries.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { CreateTransportCostDto } from './dto/create-transport-cost.dto';

@ApiTags('Itineraries')
@ApiCookieAuth('access_token')
@Controller('itineraries')
@UseGuards(JwtAuthGuard)
export class ItinerariesController {
  constructor(private readonly itinerariesService: ItinerariesService) {}

  @Post()
  create(@Body() dto: CreateItineraryDto, @CurrentUser() user: AuthUser) {
    return this.itinerariesService.create(dto, user.userId);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.itinerariesService.findAll(user.userId);
  }

  @Post(':id/clone')
  clone(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.itinerariesService.clonePublic(id, user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.itinerariesService.findOne(id, user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateItineraryDto, @CurrentUser() user: AuthUser) {
    return this.itinerariesService.update(id, dto, user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.itinerariesService.remove(id, user.userId);
  }

  @Post(':id/days')
  addDay(@Param('id') id: string, @Body() dto: AddDayDto, @CurrentUser() user: AuthUser) {
    return this.itinerariesService.addDay(id, dto, user.userId);
  }

  @Patch(':id/days/reorder')
  reorderDays(@Param('id') id: string, @Body() dto: ReorderDaysDto, @CurrentUser() user: AuthUser) {
    return this.itinerariesService.reorderDays(id, dto, user.userId);
  }

  @Patch(':id/days/:dayId')
  updateDay(
    @Param('id') id: string,
    @Param('dayId') dayId: string,
    @Body() dto: UpdateDayDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.itinerariesService.updateDay(id, dayId, dto, user.userId);
  }

  @Delete(':id/days/:dayId')
  removeDay(@Param('id') id: string, @Param('dayId') dayId: string, @CurrentUser() user: AuthUser) {
    return this.itinerariesService.removeDay(id, dayId, user.userId);
  }
  @Post(':id/days/:dayId/activities')
  addActivity(
    @Param('id') id: string,
    @Param('dayId') dayId: string,
    @Body() dto: CreateActivityDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.itinerariesService.addActivity(id, dayId, dto, user.userId);
  }
  @Post(':id/days/:dayId/budgets')
  addBudget(@Param('id') id: string, @Param('dayId') dayId: string,
    @Body() dto: CreateBudgetDto, @CurrentUser() user: AuthUser) {
    return this.itinerariesService.addBudget(id, dayId, dto, user.userId);
  }

  @Post(':id/transport-costs')
  addTransportCost(@Param('id') id: string,
    @Body() dto: CreateTransportCostDto, @CurrentUser() user: AuthUser) {
    return this.itinerariesService.addTransportCost(id, dto, user.userId);
  }

  @Get(':id/budget-summary/converted')
  getConvertedBudgetSummary(
    @Param('id') id: string,
    @Query('currency') currency: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.itinerariesService.convertedBudgetSummary(id, user.userId, currency);
  }

  @Get(':id/budget-summary')
  getBudgetSummary(@Param('id') id: string, @Query('currency') currency: string | undefined, @CurrentUser() user: AuthUser) {
    return currency ? this.itinerariesService.convertedBudgetSummary(id, user.userId, currency) : this.itinerariesService.budgetSummary(id, user.userId);
  }

}
