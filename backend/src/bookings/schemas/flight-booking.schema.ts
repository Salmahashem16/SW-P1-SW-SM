import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import {
  BOOKING_REFERENCE_INDEX_OPTIONS,
  BOOKING_STATUSES,
  PLATFORM_CURRENCY,
} from '../booking-status';
import type { BookingStatus } from '../booking-status';

export type FlightBookingDocument = HydratedDocument<FlightBooking>;

/**
 * Owner: Member 5 (Bookings & Payments). Skeleton created early so the
 * admin bookings list (ACC-17) can read it. Add segments, passengers,
 * baggage, hold expiry, payment and policy-acceptance fields here.
 *
 * Please keep these fields and names; ACC-17 reads them:
 *   userId, airlineId, departureAt (outbound departure, UTC),
 *   totalAmount, currency, status, bookingReference, createdAt.
 */
@Schema({ timestamps: true })
export class FlightBooking {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Airline',
    required: true,
    index: true,
  })
  airlineId: Types.ObjectId;

  /** Outbound segment's departure time in UTC. */
  @Prop({ type: Date, required: true })
  departureAt: Date;

  @Prop({ required: true, min: 0 })
  totalAmount: number;

  @Prop({ default: PLATFORM_CURRENCY })
  currency: string;

  @Prop({
    type: String,
    required: true,
    enum: [...BOOKING_STATUSES],
    default: 'pendingPayment',
    index: true,
  })
  status: BookingStatus;

  /** Set when the booking is Confirmed (FLT-23). */
  @Prop({ type: String, default: null })
  bookingReference: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const FlightBookingSchema = SchemaFactory.createForClass(FlightBooking);

FlightBookingSchema.index(
  { bookingReference: 1 },
  BOOKING_REFERENCE_INDEX_OPTIONS,
);
FlightBookingSchema.index({ createdAt: -1 });
