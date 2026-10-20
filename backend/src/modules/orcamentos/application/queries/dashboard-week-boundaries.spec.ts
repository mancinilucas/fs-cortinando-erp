import { describe, expect, it } from 'vitest';
import { calculateDashboardWeek } from './dashboard-week-boundaries.js';

function boundariesFor(instant: string): { start: string; end: string } {
  const { start, end } = calculateDashboardWeek(new Date(instant));

  return { start: start.toISOString(), end: end.toISOString() };
}

describe('calculateDashboardWeek', () => {
  it('starts the civil week on Monday at 00:00 in America/Sao_Paulo', () => {
    // Monday 2026-10-19 12:00 in São Paulo (UTC-3).
    expect(boundariesFor('2026-10-19T15:00:00.000Z')).toEqual({
      start: '2026-10-19T03:00:00.000Z',
      end: '2026-10-26T03:00:00.000Z',
    });
  });

  it('keeps midweek instants in the current week', () => {
    // Wednesday 2026-10-21 12:00 in São Paulo.
    expect(boundariesFor('2026-10-21T15:00:00.000Z')).toEqual({
      start: '2026-10-19T03:00:00.000Z',
      end: '2026-10-26T03:00:00.000Z',
    });
  });

  it('keeps Sunday instants in the week that started on Monday', () => {
    // Sunday 2026-10-25 23:30 in São Paulo.
    expect(boundariesFor('2026-10-26T02:30:00.000Z')).toEqual({
      start: '2026-10-19T03:00:00.000Z',
      end: '2026-10-26T03:00:00.000Z',
    });
  });

  it('handles a week that crosses a month boundary', () => {
    // Sunday 2026-11-01 23:30 in São Paulo.
    expect(boundariesFor('2026-11-02T02:30:00.000Z')).toEqual({
      start: '2026-10-26T03:00:00.000Z',
      end: '2026-11-02T03:00:00.000Z',
    });
  });

  it('handles a week that crosses a year boundary', () => {
    // Friday 2027-01-01 00:30 in São Paulo.
    expect(boundariesFor('2027-01-01T03:30:00.000Z')).toEqual({
      start: '2026-12-28T03:00:00.000Z',
      end: '2027-01-04T03:00:00.000Z',
    });
  });

  it('uses the São Paulo calendar near UTC midnight', () => {
    // Sunday 2026-10-18 23:30 in São Paulo, already Monday in UTC.
    expect(boundariesFor('2026-10-19T02:30:00.000Z')).toEqual({
      start: '2026-10-12T03:00:00.000Z',
      end: '2026-10-19T03:00:00.000Z',
    });
  });

  it('returns the same week when the instant is exactly the start', () => {
    // Monday 2026-10-19 00:00 in São Paulo.
    expect(boundariesFor('2026-10-19T03:00:00.000Z')).toEqual({
      start: '2026-10-19T03:00:00.000Z',
      end: '2026-10-26T03:00:00.000Z',
    });
  });

  it('treats the end as exclusive', () => {
    // Sunday 2026-10-25 23:59:59.999 in São Paulo still belongs to the week.
    expect(boundariesFor('2026-10-26T02:59:59.999Z')).toEqual({
      start: '2026-10-19T03:00:00.000Z',
      end: '2026-10-26T03:00:00.000Z',
    });

    // Monday 2026-10-26 00:00 in São Paulo starts the next week.
    expect(boundariesFor('2026-10-26T03:00:00.000Z')).toEqual({
      start: '2026-10-26T03:00:00.000Z',
      end: '2026-11-02T03:00:00.000Z',
    });
  });

  it('rejects an invalid instant', () => {
    expect(() => calculateDashboardWeek(new Date(Number.NaN))).toThrow(
      RangeError,
    );
  });
});
