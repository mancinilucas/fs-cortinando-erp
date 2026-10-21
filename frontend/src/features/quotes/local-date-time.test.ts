import { expect, test } from 'vitest'
import { isoToLocalDateTime, localDateTimeToIso } from './local-date-time'

test('converts Sao Paulo calendar values to UTC without requiring future dates', () => {
  expect(localDateTimeToIso('2026-10-21T12:30')).toBe('2026-10-21T15:30:00.000Z')
  expect(localDateTimeToIso('2000-07-01T12:30')).toBe('2000-07-01T15:30:00.000Z')
})
test('preserves seconds and milliseconds when editing an existing instant', () => {
  const instant = '2026-10-21T15:30:42.123Z'
  expect(isoToLocalDateTime(instant)).toBe('2026-10-21T12:30:42.123')
  expect(localDateTimeToIso(isoToLocalDateTime(instant))).toBe(instant)
})
test.each(['', '2026-02-30T12:00', '2026-10-21T24:00', 'invalid', '2026-13-01T12:00'])('rejects invalid calendar value %s', (value) => {
  expect(() => localDateTimeToIso(value)).toThrow(RangeError)
})
