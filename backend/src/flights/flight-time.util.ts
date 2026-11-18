
import { BadRequestException } from '@nestjs/common';

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);

  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      });
    } catch {
      throw new BadRequestException('Invalid airport time zone');
    }

    formatterCache.set(timeZone, formatter);
  }

  return formatter;
}

function partsAt(timestamp: number, timeZone: string): number[] {
  const parts = getFormatter(timeZone).formatToParts(
    new Date(timestamp),
  );

  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  return [
    read('year'),
    read('month'),
    read('day'),
    read('hour'),
    read('minute'),
    read('second'),
  ];
}

export function localTimeToUtc(
  localTime: string,
  timeZone: string,
): Date {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(
      localTime,
    );

  if (!match) {
    throw new BadRequestException('Invalid local date-time format');
  }

  const numbers = match.slice(1).map(Number);

  const [year, month, day, hour, minute, second] = numbers;
  
  if (year < 100) {
  throw new BadRequestException(
    'Year must be 100 or greater',
  );
}

  const wallTimestamp = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
  );

  const wallDate = new Date(wallTimestamp);

  if (
    wallDate.getUTCFullYear() !== year ||
    wallDate.getUTCMonth() + 1 !== month ||
    wallDate.getUTCDate() !== day ||
    wallDate.getUTCHours() !== hour ||
    wallDate.getUTCMinutes() !== minute ||
    wallDate.getUTCSeconds() !== second
  ) {
    throw new BadRequestException('Invalid local date-time');
  }

  const offsets = new Set<number>();

  for (let h = -36; h <= 36; h += 6) {
    const sample = wallTimestamp + h * 3600000;
    const [y, m, d, hh, mm, ss] = partsAt(
      sample,
      timeZone,
    );

    const displayed = Date.UTC(
      y,
      m - 1,
      d,
      hh,
      mm,
      ss,
    );

    offsets.add(displayed - sample);
  }

  const candidates = [...offsets]
    .map((offset) => wallTimestamp - offset)
    .filter((timestamp) =>
      partsAt(timestamp, timeZone).every(
        (value, index) => value === numbers[index],
      ),
    );

  if (candidates.length !== 1) {
    throw new BadRequestException(
      'Local time is invalid or ambiguous in this time zone',
    );
  }

  return new Date(candidates[0]);
}
