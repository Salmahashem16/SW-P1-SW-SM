import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import type { UpcomingBookingsChecker } from '../users/upcoming-bookings.checker';
import { FlightBooking } from './schemas/flight-booking.schema';
import { HotelBooking } from './schemas/hotel-booking.schema';

/**
 * ACC-12: blocks account deactivation while the user has a Confirmed flight
 * that hasn't departed or a Confirmed stay that hasn't ended.
 */
@Injectable()
export class BookingsUpcomingChecker implements UpcomingBookingsChecker {
  constructor(
    @InjectModel(FlightBooking.name)
    private readonly flightBookings: Model<FlightBooking>,
    @InjectModel(HotelBooking.name)
    private readonly hotelBookings: Model<HotelBooking>,
  ) {}

  async hasUpcomingConfirmedBookings(userId: string): Promise<boolean> {
    const user = new Types.ObjectId(userId);
    const now = new Date();

    const [flight, hotel] = await Promise.all([
      this.flightBookings
        .exists({ userId: user, status: 'confirmed', departureAt: { $gt: now } })
        .exec(),
      this.hotelBookings
        .exists({ userId: user, status: 'confirmed', checkOut: { $gt: now } })
        .exec(),
    ]);

    return Boolean(flight || hotel);
  }
}
