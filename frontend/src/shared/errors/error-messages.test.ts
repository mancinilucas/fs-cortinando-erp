import { expect, test } from 'vitest'
import { GENERIC_ERROR_MESSAGE, gateViolationMessages, getGateViolationMessage, getHttpErrorMessage, getKnownErrorMessage } from './error-messages'

test.each([400, 401, 403, 404, 409, 422, 429, 500])('provides a safe HTTP %s message', (status) => {
  expect(getHttpErrorMessage(status).length).toBeGreaterThan(0)
  expect(getHttpErrorMessage(status)).not.toContain('<')
})

test('translates known document errors without conflating configuration and status', () => {
  expect(getKnownErrorMessage('Business data is not configured')).toBe('Os dados do negócio ainda não foram configurados.')
  expect(getKnownErrorMessage('Document is not available in the current status')).toBe('O documento não está disponível na situação atual.')
  expect(getKnownErrorMessage('Document data is incomplete')).toBe('Faltam dados para gerar o documento.')
  expect(getKnownErrorMessage('Could not generate the document')).toBe('Não foi possível gerar o documento. Tente novamente.')
})

test('only translates whitelisted strings', () => {
  expect(getKnownErrorMessage('Customer not found')).toBe('Cliente não encontrado.')
  expect(getKnownErrorMessage('Invalid origin')).toBe(getHttpErrorMessage(403))
})

test.each(['<script>alert(1)</script>', 'Error: internal stack at database.ts:1', 'toString', '__proto__',
  ['Customer not found'], { message: 'Customer not found' }, null, undefined, 123])(
  'does not leak unknown or non-string messages %#', (value) => {
    expect(getKnownErrorMessage(value)).toBe(GENERIC_ERROR_MESSAGE)
  },
)

test('uses safe fallbacks for unknown HTTP status and business codes', () => {
  expect(getHttpErrorMessage(502)).toBe(GENERIC_ERROR_MESSAGE)
  expect(getGateViolationMessage('UNKNOWN')).toBe(GENERIC_ERROR_MESSAGE)
  expect(getGateViolationMessage('__proto__')).toBe(GENERIC_ERROR_MESSAGE)
})

test.each(Object.keys(gateViolationMessages))('translates backend gate code %s', (code) => {
  expect(getGateViolationMessage(code)).not.toBe(GENERIC_ERROR_MESSAGE)
  expect(getGateViolationMessage(code)).not.toContain(code)
})
