// Dashboard civil-week boundaries (D219/D225/D228/D230). The helper is pure:
// it converts the provided instant to the America/Sao_Paulo calendar and never
// reads the system clock. The interval is [start, end) and elapsed days remain
// part of the current week.

const TIME_ZONE = 'America/Sao_Paulo';
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_OFFSET_ATTEMPTS = 3;

const WEEKDAY_INDEX: Readonly<Record<string, number>> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const zonedPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
  second: number;
}

function readZonedParts(instant: Date): ZonedParts {
  const values = new Map(
    zonedPartsFormatter
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );

  const weekdayName = values.get('weekday');
  const weekday =
    weekdayName === undefined ? undefined : WEEKDAY_INDEX[weekdayName];
  const year = Number(values.get('year'));
  const month = Number(values.get('month'));
  const day = Number(values.get('day'));
  const hour = Number(values.get('hour'));
  const minute = Number(values.get('minute'));
  const second = Number(values.get('second'));

  if (
    weekday === undefined ||
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    throw new RangeError('Invalid instant');
  }

  return { year, month, day, weekday, hour, minute, second };
}

function timeZoneOffsetMs(instant: Date): number {
  const parts = readZonedParts(instant);
  const wallClockMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return wallClockMs - Math.trunc(instant.getTime() / 1000) * 1000;
}

function instantFromWallClockMs(wallClockMs: number): Date {
  let candidateMs = wallClockMs;

  for (let attempt = 0; attempt < MAX_OFFSET_ATTEMPTS; attempt += 1) {
    const adjustedMs = wallClockMs - timeZoneOffsetMs(new Date(candidateMs));

    if (adjustedMs === candidateMs) {
      return new Date(adjustedMs);
    }

    candidateMs = adjustedMs;
  }

  return new Date(candidateMs);
}

export interface DashboardWeek {
  start: Date;
  end: Date;
}

export function calculateDashboardWeek(now: Date): DashboardWeek {
  if (!Number.isFinite(now.getTime())) {
    throw new RangeError('Invalid instant');
  }

  const zoned = readZonedParts(now);
  const daysSinceMonday = (zoned.weekday + 6) % 7;
  const mondayWallClockMs = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day - daysSinceMonday,
  );

  return {
    start: instantFromWallClockMs(mondayWallClockMs),
    end: instantFromWallClockMs(mondayWallClockMs + 7 * MILLISECONDS_PER_DAY),
  };
}
