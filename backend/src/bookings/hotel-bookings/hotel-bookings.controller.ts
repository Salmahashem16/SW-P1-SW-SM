import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthUser } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import {
  AcceptPoliciesDto,
  CreateHotelBookingDto,
  ListMyHotelBookingsQueryDto,
  TestConfirmPaymentDto,
} from './dto/hotel-booking.dto';
import { HotelBookingsService } from './hotel-bookings.service';

/** HTL-16 to HTL-21. Reviews (HTL-23) live in hotels/reviews.controller.ts. */
@ApiTags('Hotel Bookings')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hotel-bookings')
export class HotelBookingsController {
  constructor(private readonly bookings: HotelBookingsService) {}

  @Post()
  @Roles('registeredUser')
  @ApiOperation({
    summary:
      'Book one or more rooms in one hotel; holds them for 10 minutes as Pending Payment (HTL-16, HTL-18)',
  })
  create(@Body() dto: CreateHotelBookingDto, @CurrentUser() user: AuthUser) {
    return this.bookings.createHold(user, dto);
  }

  @Get()
  @Roles('registeredUser')
  @ApiOperation({ summary: 'My reservations: upcoming, past or cancelled (HTL-20)' })
  listMine(@Query() query: ListMyHotelBookingsQueryDto, @CurrentUser() user: AuthUser) {
    return this.bookings.listMine(user, query);
  }

  @Get(':id')
  @Roles('registeredUser', 'admin')
  @ApiOperation({ summary: 'Reservation details (HTL-20)' })
  getOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.bookings.getOne(user, id);
  }

  @Get(':id/policies')
  @Roles('registeredUser')
  @ApiOperation({ summary: 'Hotel policies to accept before paying (PAY-02)' })
  policies(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.bookings.getPolicies(user, id);
  }

  @Post(':id/accept-policies')
  @Roles('registeredUser')
  @ApiOperation({ summary: 'Accept the hotel policies; stored with a timestamp (PAY-02)' })
  acceptPolicies(
    @Param('id') id: string,
    @Body() _dto: AcceptPoliciesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookings.acceptPolicies(user, id);
  }

  @Get(':id/cancellation-preview')
  @Roles('registeredUser')
  @ApiOperation({ summary: 'Refund you would get if you cancelled now (HTL-21)' })
  cancellationPreview(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.bookings.cancellationPreview(user, id);
  }

  @Post(':id/cancel')
  @Roles('registeredUser')
  @ApiOperation({ summary: 'Cancel a Confirmed reservation before check-in (HTL-21)' })
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.bookings.cancel(user, id);
  }

  /**
   * Development only, until the shared payment service (PAY-01) is merged:
   * stands in for its verified-payment callback so HTL-17 can be shown in
   * Swagger. Disabled when NODE_ENV=production.
   */
  @Post(':id/test-confirm-payment')
  @Roles('registeredUser')
  @ApiOperation({
    summary: 'DEV ONLY: simulate a verified payment and confirm the reservation (HTL-17)',
  })
  async testConfirm(
    @Param('id') id: string,
    @Body() dto: TestConfirmPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    await this.bookings.getPayable(user, id);
    return this.bookings.confirmPayment(id, dto.paymentId ?? `test_${Date.now()}`);
  }
}
