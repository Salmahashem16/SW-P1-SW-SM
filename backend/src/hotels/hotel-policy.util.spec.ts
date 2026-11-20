import { computeHotelRefund, selectTier } from './hotel-policy.util';

const tiers = [
  { daysBeforeCheckIn: 0, refundPercentage: 0 },
  { daysBeforeCheckIn: 7, refundPercentage: 50 },
  { daysBeforeCheckIn: 30, refundPercentage: 100 },
];

describe('hotel cancellation tiers (HTL-10)', () => {
  it('uses the highest threshold not exceeding the days remaining', () => {
    expect(selectTier(tiers, 10)?.refundPercentage).toBe(50);
    expect(selectTier(tiers, 30)?.refundPercentage).toBe(100);
    expect(selectTier(tiers, 6)?.refundPercentage).toBe(0);
  });

  it('refunds 0% when no tier applies', () => {
    const onlyLate = [{ daysBeforeCheckIn: 14, refundPercentage: 80 }];
    expect(selectTier(onlyLate, 3)).toBeNull();

    const result = computeHotelRefund(
      onlyLate,
      new Date('2026-12-10T00:00:00Z'),
      200,
      new Date('2026-12-07T15:00:00Z'),
    );
    expect(result.refundPercentage).toBe(0);
    expect(result.refundAmount).toBe(0);
  });

  it('counts calendar days and rounds the refund to cents', () => {
    const result = computeHotelRefund(
      tiers,
      new Date('2026-12-10T00:00:00Z'),
      333.33,
      new Date('2026-12-03T23:59:00Z'),
    );
    expect(result.daysBeforeCheckIn).toBe(7);
    expect(result.refundPercentage).toBe(50);
    expect(result.refundAmount).toBe(166.67);
  });
});
