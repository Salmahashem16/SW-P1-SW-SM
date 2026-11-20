import { Types } from 'mongoose';

/**
 * Fields the hotels module reads from Member 5's HotelBooking documents
 * (bookings/schemas/hotel-booking.schema.ts): userId, hotelId, checkIn,
 * checkOut, totalAmount, status, bookingReference, plus
 *
 *   rooms: [{ roomId, pricePerNight, adults, children }]
 *   holdExpiresAt: Date | null   // HTL-18, set on Pending Payment holds
 *
 * If those names ever change, change ROOM_ID_PATH / HOLD_EXPIRES_FIELD here.
 */
export const ROOM_ID_PATH = 'rooms.roomId';
export const HOLD_EXPIRES_FIELD = 'holdExpiresAt';

/** The shape hotels code reads. Every field beyond the skeleton is optional. */
export interface HotelBookingView {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  hotelId: Types.ObjectId;
  checkIn: Date;
  checkOut: Date;
  totalAmount: number;
  currency?: string;
  status: string;
  bookingReference: string | null;
  rooms?: { roomId: Types.ObjectId; pricePerNight?: number; adults?: number; children?: number[] }[];
  holdExpiresAt?: Date | null;
  createdAt?: Date;
}

/**
 * Reservations that occupy rooms: Confirmed, or Pending Payment with a hold
 * that has not expired (HTL-11, HTL-15, HTL-18). A Pending Payment booking
 * without holdExpiresAt is treated as still holding, to be safe.
 */
export function occupyingStatusFilter(
  now: Date = new Date(),
): Record<string, unknown> {
  return {
    $or: [
      { status: 'confirmed' },
      {
        status: 'pendingPayment',
        $or: [
          { [HOLD_EXPIRES_FIELD]: { $gt: now } },
          { [HOLD_EXPIRES_FIELD]: null },
        ],
      },
    ],
  };
}

/** Reservations on these rooms overlapping the night range [from, to). */
export function occupyingOverlapFilter(
  roomIds: Types.ObjectId[],
  from: Date,
  to: Date,
  now: Date = new Date(),
): Record<string, unknown> {
  return {
    [ROOM_ID_PATH]: { $in: roomIds },
    checkIn: { $lt: to },
    checkOut: { $gt: from },
    ...occupyingStatusFilter(now),
  };
}
