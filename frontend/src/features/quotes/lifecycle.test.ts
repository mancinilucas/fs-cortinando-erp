import { expect, test } from 'vitest'
import { lifecycleActions, validityToIso } from './lifecycle'
import { quoteFixture } from './fixtures.test-support'

test.each([
  ['DRAFT', false, ['send', 'cancel', 'delete']], ['SENT', false, ['confirm', 'renew', 'cancel']],
  ['SENT', true, ['renew', 'cancel']], ['CONFIRMED', false, ['reopen', 'cancel', 'startProduction']],
  ['IN_PRODUCTION', false, ['complete']], ['COMPLETED', false, []], ['CANCELLED', false, []],
] as const)('uses the server status/expired matrix for %s %#', (status, expired, actions) => {
  expect(lifecycleActions({ ...quoteFixture, status, expired, validUntil: '2000-01-01T12:00:00Z' })).toEqual(actions)
})
test('converts local validity using the configured Sao Paulo zone rather than the host zone', () => {
  expect(validityToIso('2099-10-21T12:30')).toBe('2099-10-21T15:30:00.000Z')
  expect(validityToIso('2028-02-29T23:59')).toBe('2028-03-01T02:59:00.000Z')
})
test.each(['', '2099-02-30T12:00', '2099-01-01T25:00', '2099-01-01', 'private', '2099-01-01T12:00Z'])('rejects invalid validity %s', (value) => {
  expect(() => validityToIso(value)).toThrow(RangeError)
})
