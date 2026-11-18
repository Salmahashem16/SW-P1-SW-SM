
import { BadRequestException } from '@nestjs/common';
import { localTimeToUtc } from './flight-time.util';

describe('GEN-06: Airport-local flight times', () => {
  it('converts Cairo local time to UTC', () => {
    const result = localTimeToUtc(
      '2026-12-15T08:00:00',
      'Africa/Cairo',
    );

    expect(result.toISOString()).toBe(
      '2026-12-15T06:00:00.000Z',
    );
  });

  it('converts New York summer time to UTC', () => {
    const result = localTimeToUtc(
      '2026-07-15T08:00:00',
      'America/New_York',
    );

    expect(result.toISOString()).toBe(
      '2026-07-15T12:00:00.000Z',
    );
  });

  it('rejects impossible calendar dates', () => {
    expect(() =>
      localTimeToUtc(
        '2026-02-30T08:00:00',
        'Africa/Cairo',
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects nonexistent times during DST transition', () => {
    expect(() =>
      localTimeToUtc(
        '2026-03-08T02:30:00',
        'America/New_York',
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects ambiguous times during DST transition', () => {
    expect(() =>
      localTimeToUtc(
        '2026-11-01T01:30:00',
        'America/New_York',
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects invalid time zones', () => {
    expect(() =>
      localTimeToUtc(
        '2026-12-15T08:00:00',
        'Invalid/TimeZone',
      ),
    ).toThrow(BadRequestException);
  });
});
