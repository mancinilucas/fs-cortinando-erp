import { expect, test } from 'vitest'
import { DISPLAY_TIME_ZONE, formatDate, formatDateTime, formatTime } from './dates'

test('uses the explicitly specified Sao Paulo time zone', () => {
  expect(DISPLAY_TIME_ZONE).toBe('America/Sao_Paulo')
  expect(formatDateTime('2026-10-21T15:30:00.000Z')).toBe('21/10/2026 às 12:30')
  expect(formatTime('2026-10-21T15:30:00Z')).toBe('12:30')
})

test('handles day and year boundaries without using the host time zone', () => {
  expect(formatDate('2026-01-01T01:00:00Z')).toBe('31/12/2025')
  expect(formatDateTime('2026-01-01T03:00:00Z')).toBe('01/01/2026 às 00:00')
})

test('accepts offset instants and leap days', () => {
  expect(formatDateTime('2026-10-21T12:30:00-03:00')).toBe('21/10/2026 às 12:30')
  expect(formatDate('2024-02-29T12:00:00Z')).toBe('29/02/2024')
})

test.each(['', 'invalid', '2026-10-21', '2026-10-21T12:00:00', '2026-02-30T12:00:00Z',
  '2026-13-01T00:00:00Z', '2026-10-21T25:00:00Z'])('rejects invalid or ambiguous date %s', (value) => {
  expect(() => formatDate(value)).toThrow(RangeError)
  expect(() => formatTime(value)).toThrow(RangeError)
  expect(() => formatDateTime(value)).toThrow(RangeError)
})
