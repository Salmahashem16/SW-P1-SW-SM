

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import {
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { CreateAirlineDto } from './dto/create-airline.dto';
import { UpdateAirlineDto } from './dto/update-airline.dto';
import { CreateFlightDto } from './dto/create-flight.dto';
import { FlightsService } from './flights.service';

import { CreateCabinDto } from './dto/create-cabin.dto';
import { UpdateCabinDto } from './dto/update-cabin.dto';
import { UpdateBaggagePolicyDto } from './dto/update-baggage-policy.dto';

@ApiTags('Flights')
@Controller()
export class FlightsController {
  constructor(
    private readonly flightsService: FlightsService,
  ) {}

  @Get('airports')
  @ApiOperation({
    summary: 'Get airports (FLT-02)',
  })
  getAirports() {
    return this.flightsService.getAirports();
  }

  @Post('airlines')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Create airline (FLT-01)',
  })
  createAirline(@Body() dto: CreateAirlineDto) {
    return this.flightsService.createAirline(dto);
  }

  @Get('airlines/:id')
  @ApiOperation({
    summary: 'Get airline (FLT-01)',
  })
  getAirline(@Param('id') id: string) {
    return this.flightsService.getAirline(id);
  }

  @Patch('airlines/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('airlineModerator')
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Update airline (FLT-01)',
  })
  updateAirline(
    @Param('id') id: string,
    @Body() dto: UpdateAirlineDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.flightsService.updateAirline(
      id,
      dto,
      user,
    );
  }

  @Post('flights')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('airlineModerator')
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Create flight (FLT-03)',
  })
  createFlight(
    @Body() dto: CreateFlightDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.flightsService.createFlight(dto, user);
  }

  @Post('flights/:id/cabins')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('airlineModerator')
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Add flight cabin (FLT-04)',
  })
  addCabin(
    @Param('id') id: string,
    @Body() dto: CreateCabinDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.flightsService.addCabin(id, dto, user);
  }

  @Patch('flights/:id/cabins/:cabinId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('airlineModerator')
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Update flight cabin (FLT-04)',
  })
  updateCabin(
    @Param('id') id: string,
    @Param('cabinId') cabinId: string,
    @Body() dto: UpdateCabinDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.flightsService.updateCabin(
      id,
      cabinId,
      dto,
      user,
    );
  }

  @Put('airlines/:id/baggage-policy')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('airlineModerator')
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Update extra baggage policy (FLT-08)',
  })
  updateBaggagePolicy(
    @Param('id') id: string,
    @Body() dto: UpdateBaggagePolicyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.flightsService.updateBaggagePolicy(
      id,
      dto,
      user,
    );
  }

}
