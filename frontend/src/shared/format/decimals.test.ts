import { expect, test } from 'vitest'
import { formatInteger, formatMeasure, formatQuantity } from './decimals'

test.each([
  [0, '0'], [-0, '0'], [1, '1'], [1.23, '1,23'], [1.234, '1,234'],
  [1.2345, '1,235'], [1234.567, '1.234,567'],
])('formats measure %s for display', (value, expected) => {
  expect(formatMeasure(value)).toBe(expected)
})

test.each([[2.375125, '2,375125'], [2.3751259, '2,375126'], [3.5, '3,5'], [0, '0']])(
  'formats quantity %s with up to six places', (value, expected) => {
    expect(formatQuantity(value)).toBe(expected)
  },
)

test('formats integer counts without converting fractions', () => {
  expect(formatInteger(12345)).toBe('12.345')
  expect(formatInteger(0)).toBe('0')
  expect(() => formatInteger(1.5)).toThrow(RangeError)
  expect(() => formatInteger(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError)
})

test.each([NaN, Infinity, -Infinity])('rejects non-finite number %s', (value) => {
  expect(() => formatMeasure(value)).toThrow(RangeError)
  expect(() => formatQuantity(value)).toThrow(RangeError)
  expect(() => formatInteger(value)).toThrow(RangeError)
})
