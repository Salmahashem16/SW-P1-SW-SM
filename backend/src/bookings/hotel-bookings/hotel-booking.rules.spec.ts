import { BadRequestException } from '@nestjs/common';

import {
  assertGuestsFit,
  bookingGroup,
  effectiveStatus,
  generateBookingReference,
  holdExpiry,
  HOLD_MINUTES,
  priceStay,
} from './hotel-booking.rules';

const rooms = new Map([
  ['a', { name: '101', maxOccupancy: 2, pricePerNight: 100 }],
  ['b', { name: '102', maxOccupancy: 3, pricePerNight: 80.5 }],
]);

describe('hotel booking guests (HTL-16)', () => {
  it('accepts guests within each room occupancy', () => {
    expect(() =>
      assertGuestsFit(
        [
          { roomId: 'a', adults: 2, children: [] },
          { roomId: 'b', adults: 0, children: [4, 9, 17] },
        ],
        rooms,
      ),
    ).not.toThrow();
  });

  it('needs at least one adult in the reservation', () => {
    expect(() =>
      assertGuestsFit([{ roomId: 'a', adults: 0, children: [5] }], rooms),
    ).toThrow(BadRequestException);
  });

  it('rejects a room over its max occupancy', () => {
    expect(() =>
      assertGuestsFit([{ roomId: 'a', adults: 2, children: [3] }], rooms),
    ).toThrow(/at most 2/);
  });

  it('rejects an empty room and child ages outside 0-17', () => {
    expect(() =>
      assertGuestsFit(
        [
          { roomId: 'a', adults: 1, children: [] },
          { roomId: 'b', adults: 0, children: [] },
        ],
        rooms,
      ),
    ).toThrow(/at least one guest/);
    expect(() =>
      assertGuestsFit([{ roomId: 'a', adults: 1, children: [18] }], rooms),
    ).toThrow(BadRequestException);
  });
});

describe('hotel booking price (HTL-16)', () => {
  it('sums nights x price per room, in cents', () => {
    const result = priceStay([100, 80.5], 3);
    expect(result.subtotals).toEqual([300, 241.5]);
    expect(result.total).toBe(541.5);
  });
});

describe('hotel booking lifecycle (HTL-18, HTL-20, GEN-11)', () => {
  const now = new Date('2026-12-01T10:00:00Z');

  it('holds rooms for 10 minutes', () => {
    expect(HOLD_MINUTES).toBe(10);
    expect(holdExpiry(now).toISOString()).toBe('2026-12-01T10:10:00.000Z');
  });

  it('treats an expired hold as expired and cancelled-group', () => {
    const booking = {
      status: 'pendingPayment' as const,
      holdExpiresAt: new Date('2026-12-01T09:59:00Z'),
      checkOut: new Date('2026-12-05T00:00:00Z'),
    };
    expect(effectiveStatus(booking, now)).toBe('expired');
    expect(bookingGroup(booking, now)).toBe('cancelled');
  });

  it('groups confirmed stays as upcoming until check-out, then past', () => {
    const booking = {
      status: 'confirmed' as const,
      holdExpiresAt: null,
      checkOut: new Date('2026-12-05T00:00:00Z'),
    };
    expect(bookingGroup(booking, now)).toBe('upcoming');
    expect(effectiveStatus(booking, new Date('2026-12-05T00:00:00Z'))).toBe('completed');
    expect(bookingGroup(booking, new Date('2026-12-06T00:00:00Z'))).toBe('past');
  });
});

describe('booking reference (HTL-17)', () => {
  it('looks like HTL- plus 8 unambiguous characters', () => {
    expect(generateBookingReference()).toMatch(/^HTL-[A-HJ-NP-Z2-9]{8}$/);
  });
});
