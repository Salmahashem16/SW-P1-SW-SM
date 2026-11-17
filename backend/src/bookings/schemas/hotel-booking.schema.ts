import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import {
  BOOKING_REFERENCE_INDEX_OPTIONS,
  BOOKING_STATUSES,
  PLATFORM_CURRENCY,
} from '../booking-status';
import type { BookingStatus } from '../booking-status';

export type HotelBookingDocument = HydratedDocument<HotelBooking>;

/**
 * Owner: Member 5 (Bookings & Payments). Skeleton created early so the
 * admin bookings list (ACC-17) can read it. Add rooms, guests, hold expiry,
 * payment and policy-acceptance fields here.
 *
 * Please keep these fields and names; ACC-17 reads them:
 *   userId, hotelId, checkIn, checkOut, totalAmount, currency, status,
 *   bookingReference, createdAt.
 */
@Schema({ timestamps: true })
export class HotelBooking {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true,
  })
  hotelId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  checkIn: Date;

  @Prop({ type: Date, required: true })
  checkOut: Date;

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

  /** Set when the reservation is Confirmed (HTL-17). */
  @Prop({ type: String, default: null })
  bookingReference: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const HotelBookingSchema = SchemaFactory.createForClass(HotelBooking);

HotelBookingSchema.index(
  { bookingReference: 1 },
  BOOKING_REFERENCE_INDEX_OPTIONS,
);
HotelBookingSchema.index({ createdAt: -1 });
