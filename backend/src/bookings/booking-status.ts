/**
 * GEN-11: Pending Payment -> Confirmed -> Completed, with
 * Pending Payment -> Expired (hold timeout) and
 * Confirmed -> Cancelled (user or provider cancellation).
 * Shared by flight bookings and hotel reservations.
 */
export const BOOKING_STATUSES = [
  'pendingPayment',
  'confirmed',
  'completed',
  'expired',
  'cancelled',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_TYPES = ['flight', 'hotel'] as const;
export type BookingType = (typeof BOOKING_TYPES)[number];

/** PAY-04: one platform currency for all prices, payments and refunds. */
export const PLATFORM_CURRENCY = 'USD';

/**
 * The reference is only generated once the booking is Confirmed (FLT-23,
 * HTL-17), so it is unique among documents that have one.
 */
export const BOOKING_REFERENCE_INDEX_OPTIONS = {
  unique: true,
  partialFilterExpression: { bookingReference: { $type: 'string' } },
} as const;
