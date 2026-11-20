import { DAY_MS, startOfDay } from './date-range.util';

export interface CancellationTier {
  daysBeforeCheckIn: number;
  refundPercentage: number;
}

/** Whole calendar days from the cancellation day to the check-in day. */
export function daysBeforeCheckIn(checkIn: Date, cancelledAt: Date): number {
  return Math.floor(
    (startOfDay(checkIn).getTime() - startOfDay(cancelledAt).getTime()) / DAY_MS,
  );
}

/**
 * HTL-10 (same rule as FLT-09): use the tier with the highest threshold not
 * exceeding the days remaining; if no tier applies, the refund is 0%.
 */
export function selectTier(
  tiers: CancellationTier[],
  daysRemaining: number,
): CancellationTier | null {
  let best: CancellationTier | null = null;

  for (const tier of tiers) {
    if (
      tier.daysBeforeCheckIn <= daysRemaining &&
      (!best || tier.daysBeforeCheckIn > best.daysBeforeCheckIn)
    ) {
      best = tier;
    }
  }

  return best;
}

/**
 * Refund for cancelling a whole reservation (HTL-21 uses this on the full
 * total). Amounts are rounded to cents.
 */
export function computeHotelRefund(
  tiers: CancellationTier[],
  checkIn: Date,
  totalAmount: number,
  cancelledAt: Date = new Date(),
) {
  const daysRemaining = daysBeforeCheckIn(checkIn, cancelledAt);
  const tier = selectTier(tiers, daysRemaining);
  const refundPercentage = tier ? tier.refundPercentage : 0;
  const refundAmount =
    Math.round(totalAmount * refundPercentage) / 100;

  return {
    daysBeforeCheckIn: daysRemaining,
    appliedTier: tier,
    refundPercentage,
    refundAmount,
  };
}
