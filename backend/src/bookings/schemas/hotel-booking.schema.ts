import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import {
  BOOKING_REFERENCE_INDEX_OPTIONS,
  BOOKING_STATUSES,
  PLATFORM_CURRENCY,
} from '../booking-status';
import type { BookingStatus } from '../booking-status';

export type HotelBookingDocument = HydratedDocument<HotelBooking>;

/** One booked room with its guests and the price agreed at booking (HTL-16). */
@Schema({ _id: false })
export class HotelBookingRoom {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Room', required: true })
  roomId: Types.ObjectId;

  /** Snapshot so the booking still reads well if the room is renamed. */
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, default: null })
  type: string | null;

  /** HTL-05: later price changes don't affect this reservation. */
  @Prop({ required: true, min: 0 })
  pricePerNight: number;

  @Prop({ required: true, min: 0, validate: Number.isInteger })
  adults: number;

  /** Children's ages, 0-17. */
  @Prop({ type: [Number], default: [] })
  children: number[];

  @Prop({ required: true, min: 0 })
  subtotal: number;
}

export const HotelBookingRoomSchema =
  SchemaFactory.createForClass(HotelBookingRoom);

/** HTL-10 tier as it was when the reservation was made. */
@Schema({ _id: false })
export class BookedCancellationTier {
  @Prop({ required: true, min: 0 })
  daysBeforeCheckIn: number;

  @Prop({ required: true, min: 0, max: 100 })
  refundPercentage: number;
}

export const BookedCancellationTierSchema = SchemaFactory.createForClass(
  BookedCancellationTier,
);

export const REFUND_STATUSES = ['none', 'pending', 'refunded', 'failed'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

/**
 * Owner: Member 5 (hotel reservations). A reservation holds one or more rooms
 * of one hotel for the same dates (HTL-16), is held for 10 minutes while the
 * user pays (HTL-18), and is Confirmed only after verified payment (HTL-17).
 *
 * Field names `rooms.roomId` and `holdExpiresAt` are read by the hotels
 * module (hotels/hotel-booking-contract.ts); keep them in sync.
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

  @Prop({ type: [HotelBookingRoomSchema], required: true })
  rooms: HotelBookingRoom[];

  @Prop({ required: true, min: 1, validate: Number.isInteger })
  nights: number;

  /** HTL-18: end of the Pending Payment hold; null once Confirmed. */
  @Prop({ type: Date, default: null, index: true })
  holdExpiresAt: Date | null;

  /** HTL-09 / HTL-10 snapshot shown in the booking summary (PAY-02). */
  @Prop({ type: String, default: null })
  checkInTime: string | null;

  @Prop({ type: String, default: null })
  checkOutTime: string | null;

  @Prop({ type: [BookedCancellationTierSchema], default: [] })
  cancellationTiers: BookedCancellationTier[];

  /** PAY-02: payment is blocked until the policies are accepted. */
  @Prop({ type: Date, default: null })
  policiesAcceptedAt: Date | null;

  /** PAY-01: id of the verified payment (e.g. Stripe PaymentIntent). */
  @Prop({ type: String, default: null })
  paymentId: string | null;

  @Prop({ type: Date, default: null })
  confirmedAt: Date | null;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  /** HTL-21 */
  @Prop({ type: Date, default: null })
  cancelledAt: Date | null;

  @Prop({ type: Number, default: null })
  refundPercentage: number | null;

  @Prop({ type: Number, default: null })
  refundAmount: number | null;

  /** PAY-03: set by the payment service once the refund is issued. */
  @Prop({ type: String, enum: [...REFUND_STATUSES], default: 'none' })
  refundStatus: RefundStatus;

  @Prop({ type: String, default: null })
  refundId: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const HotelBookingSchema = SchemaFactory.createForClass(HotelBooking);

HotelBookingSchema.index(
  { bookingReference: 1 },
  BOOKING_REFERENCE_INDEX_OPTIONS,
);
HotelBookingSchema.index({ createdAt: -1 });
HotelBookingSchema.index({ userId: 1, checkIn: -1 });
// HTL-18 / HTL-16: overlap checks look up bookings by room and dates.
HotelBookingSchema.index({ 'rooms.roomId': 1, checkIn: 1, checkOut: 1 });
// GEN-11 status job
HotelBookingSchema.index({ status: 1, checkOut: 1 });
