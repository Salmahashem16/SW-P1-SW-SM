import { BadRequestException } from '@nestjs/common';
import { randomInt } from 'node:crypto';

import type { BookingStatus } from '../booking-status';

/** HTL-18: rooms are held for 10 minutes while the user pays. */
export const HOLD_MINUTES = 10;

export const MAX_CHILD_AGE = 17;

export interface RoomSelection {
  roomId: string;
  adults: number;
  children: number[];
}

export interface PricedRoom {
  name: string;
  maxOccupancy: number;
  pricePerNight: number;
}

/**
 * HTL-16 guest rules: at least one adult in the reservation, at least one
 * guest per room, children aged 0-17, and no room over its max occupancy.
 */
export function assertGuestsFit(
  selections: RoomSelection[],
  roomsById: Map<string, PricedRoom>,
): void {
  const totalAdults = selections.reduce((sum, s) => sum + s.adults, 0);
  if (totalAdults < 1) {
    throw new BadRequestException('A reservation needs at least one adult');
  }

  for (const selection of selections) {
    const room = roomsById.get(selection.roomId);
    if (!room) {
      throw new BadRequestException('One or more rooms were not found in this hotel');
    }

    if (selection.children.some((age) => !Number.isInteger(age) || age < 0 || age > MAX_CHILD_AGE)) {
      throw new BadRequestException(`Children's ages must be whole numbers from 0 to ${MAX_CHILD_AGE}`);
    }

    const guests = selection.adults + selection.children.length;
    if (guests < 1) {
      throw new BadRequestException(`Room ${room.name} needs at least one guest`);
    }
    if (guests > room.maxOccupancy) {
      throw new BadRequestException(
        `Room ${room.name} sleeps at most ${room.maxOccupancy} guests (got ${guests})`,
      );
    }
  }
}

/** Rounds to cents. */
export function toCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** HTL-16: total = sum over rooms of nights x that room's price at booking. */
export function priceStay(pricesPerNight: number[], nights: number) {
  const subtotals = pricesPerNight.map((price) => toCents(price * nights));
  const total = toCents(subtotals.reduce((sum, value) => sum + value, 0));
  return { subtotals, total };
}

export function holdExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + HOLD_MINUTES * 60 * 1000);
}

/** HTL-18: a Pending Payment reservation whose hold has run out. */
export function isHoldExpired(
  booking: { status: BookingStatus; holdExpiresAt?: Date | null },
  now: Date = new Date(),
): boolean {
  return (
    booking.status === 'pendingPayment' &&
    Boolean(booking.holdExpiresAt) &&
    booking.holdExpiresAt! <= now
  );
}

/**
 * GEN-11: the status a reader should see, even if the status job has not run
 * yet (an expired hold reads as expired, a finished stay as completed).
 */
export function effectiveStatus(
  booking: { status: BookingStatus; holdExpiresAt?: Date | null; checkOut: Date },
  now: Date = new Date(),
): BookingStatus {
  if (isHoldExpired(booking, now)) {
    return 'expired';
  }
  if (booking.status === 'confirmed' && booking.checkOut <= now) {
    return 'completed';
  }
  return booking.status;
}

export const BOOKING_GROUPS = ['upcoming', 'past', 'cancelled'] as const;
export type BookingGroup = (typeof BOOKING_GROUPS)[number];

/**
 * HTL-20 grouping. Upcoming: paid or still-held stays that haven't ended.
 * Past: completed stays. Cancelled: cancelled reservations and expired holds.
 */
export function bookingGroup(
  booking: { status: BookingStatus; holdExpiresAt?: Date | null; checkOut: Date },
  now: Date = new Date(),
): BookingGroup {
  const status = effectiveStatus(booking, now);
  if (status === 'cancelled' || status === 'expired') {
    return 'cancelled';
  }
  if (status === 'completed') {
    return 'past';
  }
  return 'upcoming';
}

/** Mongo filter matching bookingGroup() for list queries. */
export function bookingGroupFilter(
  group: BookingGroup,
  now: Date = new Date(),
): Record<string, unknown> {
  switch (group) {
    case 'upcoming':
      return {
        checkOut: { $gt: now },
        $or: [
          { status: 'confirmed' },
          { status: 'pendingPayment', holdExpiresAt: { $gt: now } },
        ],
      };
    case 'past':
      return {
        $or: [
          { status: 'completed' },
          { status: 'confirmed', checkOut: { $lte: now } },
        ],
      };
    case 'cancelled':
      return {
        $or: [
          { status: { $in: ['cancelled', 'expired'] } },
          { status: 'pendingPayment', holdExpiresAt: { $lte: now } },
        ],
      };
  }
}

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** HTL-17: e.g. "HTL-7K3QX9MZ". Uniqueness is enforced by a unique index. */
export function generateBookingReference(): string {
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  }
  return `HTL-${code}`;
}
