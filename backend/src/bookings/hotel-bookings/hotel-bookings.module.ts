import { Module } from '@nestjs/common';

import { HotelsModule } from '../../hotels/hotels.module';
import { HotelBookingStatusJob } from './hotel-booking-status.job';
import { HotelBookingsController } from './hotel-bookings.controller';
import { HotelBookingsService } from './hotel-bookings.service';

/**
 * Owner: Member 5. Hotel reservations (HTL-16 to HTL-21) on top of Member 4's
 * HotelInventoryService. The HotelBooking model comes from the global
 * BookingsModule.
 *
 * For the payment service (PAY-01 to PAY-03), HotelBookingsService exposes:
 *  - getPayable(user, id): amount/currency to charge; checks hold + policies
 *  - confirmPayment(id, paymentId): call after the Stripe webhook verifies
 *  - recordRefund(id, status, refundId): after issuing a refund
 * and emits 'hotelBooking.cancelled' with refundAmount for PAY-03.
 */
@Module({
  imports: [HotelsModule],
  controllers: [HotelBookingsController],
  providers: [HotelBookingsService, HotelBookingStatusJob],
  exports: [HotelBookingsService],
})
export class HotelBookingsModule {}
