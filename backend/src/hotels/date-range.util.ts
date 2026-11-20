import { BadRequestException } from '@nestjs/common';

/**
 * Hotel dates are calendar days, stored as UTC midnight.
 *
 * Every range in the hotels module is half-open [from, to), counted in
 * nights, like a stay: a stay with checkIn 2026-12-01 and checkOut
 * 2026-12-03 uses the nights of the 1st and the 2nd. Two ranges that only
 * touch (one ends on the day the other starts) do not overlap.
 */
export const DAY_MS = 24 * 60 * 60 * 1000;

export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface DayRange {
  from: Date;
  to: Date;
}

/** Parses "YYYY-MM-DD" into UTC midnight. Rejects impossible dates. */
export function parseDay(value: string, field = 'date'): Date {
  if (!DAY_PATTERN.test(value)) {
    throw new BadRequestException(`${field} must be a date in YYYY-MM-DD format`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException(`${field} is not a valid date`);
  }

  return date;
}

export function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** UTC midnight of the given instant (default: now). */
export function startOfDay(date: Date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function nightsBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/** Half-open overlap: touching ranges do not overlap. */
export function rangesOverlap(a: DayRange, b: DayRange): boolean {
  return a.from < b.to && b.from < a.to;
}

/**
 * True if the union of `ranges` covers every night of `target`.
 * Ranges may be unsorted and may touch each other.
 */
export function rangesCover(ranges: DayRange[], target: DayRange): boolean {
  const sorted = [...ranges].sort((a, b) => a.from.getTime() - b.from.getTime());
  let coveredUntil = target.from;

  for (const range of sorted) {
    if (range.from > coveredUntil) {
      break;
    }

    if (range.to > coveredUntil) {
      coveredUntil = range.to;
    }

    if (coveredUntil >= target.to) {
      return true;
    }
  }

  return coveredUntil >= target.to;
}

/**
 * Validates a [from, to) range given as YYYY-MM-DD strings.
 * `notInPast` enforces from >= today (UTC), used for stays (HTL-11, HTL-18).
 */
export function parseRange(
  fromValue: string,
  toValue: string,
  options: { fromField?: string; toField?: string; notInPast?: boolean } = {},
): DayRange {
  const fromField = options.fromField ?? 'from';
  const toField = options.toField ?? 'to';
  const from = parseDay(fromValue, fromField);
  const to = parseDay(toValue, toField);

  if (to <= from) {
    throw new BadRequestException(`${toField} must be after ${fromField}`);
  }

  if (options.notInPast && from < startOfDay()) {
    throw new BadRequestException(`${fromField} cannot be in the past`);
  }

  return { from, to };
}
