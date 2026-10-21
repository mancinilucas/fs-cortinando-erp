import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { parseDecimalInput, parseMoneyInput } from './numeric-input'
import { DecimalInput } from './DecimalInput'
import { MoneyInput } from './MoneyInput'

test.each([['0,29', 29], ['1.01', 101], ['1234,56', 123456], ['-0,01', -1], ['21474836,47', 2147483647], ['-21474836,48', -2147483648], ['', null]])('parses money %s exactly as cents', (value, cents) => {
  expect(parseMoneyInput(value)).toBe(cents)
})
test.each(['1,234.56', '1.234,56', '0.001', 'NaN', 'Infinity', '1e3', '21474836.48', '-21474836.49'])('rejects invalid money %s', (value) => {
  expect(() => parseMoneyInput(value)).toThrow(RangeError)
})
test('preserves decimal precision and optional empty values', () => {
  expect(parseDecimalInput('1,234', 3)).toBe(1.234)
  expect(parseDecimalInput('1.123456', 6)).toBe(1.123456)
  expect(parseDecimalInput(' ', 3)).toBeNull()
  expect(() => parseDecimalInput('1,2345', 3)).toThrow()
  expect(() => parseDecimalInput('1.1234567', 6)).toThrow()
})
test('uses field-specific positivity and limits without domain calculations', () => {
  expect(() => parseMoneyInput('0', { strictlyPositive: true })).toThrow()
  expect(() => parseMoneyInput('-1', { min: 0 })).toThrow()
  expect(() => parseDecimalInput('-1', 3, { min: 0 })).toThrow()
  expect(() => parseDecimalInput('0', 6, { strictlyPositive: true })).toThrow()
  expect(() => parseDecimalInput('101', 2, { max: 100 })).toThrow()
  expect(parseDecimalInput('0', 3, { min: 0 })).toBe(0)
})
test('numeric controls accept textual commas and validate without rounding invalid input', () => {
  render(<><DecimalInput label="Medida" /><MoneyInput label="Preço" rules={{ strictlyPositive: true }} /></>)
  const measure = screen.getByLabelText('Medida'); const price = screen.getByLabelText('Preço')
  expect(measure).toHaveAttribute('inputmode', 'decimal')
  expect(price).toHaveAttribute('type', 'text')
  fireEvent.change(measure, { target: { value: '1,2345' } }); fireEvent.blur(measure)
  expect(measure).toHaveAttribute('aria-invalid', 'true')
  expect(measure).toHaveValue('1,2345')
  fireEvent.change(measure, { target: { value: '1,234' } }); fireEvent.blur(measure)
  expect(measure).not.toHaveAttribute('aria-invalid', 'true')
  fireEvent.change(price, { target: { value: '0' } }); fireEvent.blur(price)
  expect(price).toHaveAttribute('aria-invalid', 'true')
})
