import { BadRequestException } from '@nestjs/common';

import {
  addDays,
  formatDay,
  nightsBetween,
  parseDay,
  parseRange,
  rangesCover,
  rangesOverlap,
  startOfDay,
} from './date-range.util';

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe('date-range util', () => {
  it('parses calendar days and rejects impossible ones', () => {
    expect(parseDay('2026-12-01').toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(() => parseDay('2026-02-30')).toThrow(BadRequestException);
    expect(() => parseDay('01/12/2026')).toThrow(BadRequestException);
  });

  it('treats ranges as half-open', () => {
    const a = { from: d('2026-12-01'), to: d('2026-12-05') };
    expect(rangesOverlap(a, { from: d('2026-12-05'), to: d('2026-12-07') })).toBe(false);
    expect(rangesOverlap(a, { from: d('2026-12-04'), to: d('2026-12-07') })).toBe(true);
    expect(nightsBetween(a.from, a.to)).toBe(4);
  });

  it('checks coverage across touching ranges', () => {
    const ranges = [
      { from: d('2026-12-05'), to: d('2026-12-10') },
      { from: d('2026-12-01'), to: d('2026-12-05') },
    ];
    expect(rangesCover(ranges, { from: d('2026-12-02'), to: d('2026-12-09') })).toBe(true);
    expect(rangesCover(ranges, { from: d('2026-12-08'), to: d('2026-12-11') })).toBe(false);
    expect(
      rangesCover([{ from: d('2026-12-01'), to: d('2026-12-03') }, { from: d('2026-12-04'), to: d('2026-12-06') }],
        { from: d('2026-12-02'), to: d('2026-12-05') }),
    ).toBe(false);
  });

  it('validates stay ranges', () => {
    const tomorrow = formatDay(addDays(startOfDay(), 1));
    const yesterday = formatDay(addDays(startOfDay(), -1));
    expect(() => parseRange(tomorrow, tomorrow)).toThrow(/must be after/);
    expect(() => parseRange(yesterday, tomorrow, { notInPast: true })).toThrow(/past/);
  });
});
