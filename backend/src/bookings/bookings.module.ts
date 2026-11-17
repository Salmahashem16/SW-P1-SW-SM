import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UPCOMING_BOOKINGS_CHECKER } from '../users/upcoming-bookings.checker';
import { BookingsUpcomingChecker } from './bookings-upcoming.checker';
import {
  FlightBooking,
  FlightBookingSchema,
} from './schemas/flight-booking.schema';
import {
  HotelBooking,
  HotelBookingSchema,
} from './schemas/hotel-booking.schema';

/**
 * Owner: Member 5 (Bookings & Payments). Add controllers and services
 * (holds, payments, cancellations) here. MongooseModule is exported so the
 * admin module can read bookings (ACC-17).
 *
 * Global so UsersService gets the ACC-12 upcoming-bookings checker.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FlightBooking.name, schema: FlightBookingSchema },
      { name: HotelBooking.name, schema: HotelBookingSchema },
    ]),
  ],
  providers: [
    { provide: UPCOMING_BOOKINGS_CHECKER, useClass: BookingsUpcomingChecker },
  ],
  exports: [MongooseModule, UPCOMING_BOOKINGS_CHECKER],
})
export class BookingsModule {}
