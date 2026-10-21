import { describe, expect, test } from 'vitest'
import { formatMoney } from './money'

describe('formatMoney', () => {
  test.each([
    [0, 'R$\u00a00,00'], [1, 'R$\u00a00,01'], [10, 'R$\u00a00,10'],
    [12590, 'R$\u00a0125,90'], [123456789, 'R$\u00a01.234.567,89'],
    [-1, '-R$\u00a00,01'], [-99, '-R$\u00a00,99'], [-100, '-R$\u00a01,00'],
    [-12590, '-R$\u00a0125,90'],
    [Number.MAX_SAFE_INTEGER, 'R$\u00a090.071.992.547.409,91'],
    [Number.MIN_SAFE_INTEGER, '-R$\u00a090.071.992.547.409,91'],
  ])('formats %s cents as %s without losing cents', (cents, expected) => {
    expect(formatMoney(cents)).toBe(expected)
  })

  test.each([1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid cents %s', (value) => expect(() => formatMoney(value)).toThrow(RangeError),
  )
})
