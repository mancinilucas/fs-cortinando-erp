import { expect, test } from 'vitest'
import { parseApiError } from './parse-api-error'
import { GENERIC_ERROR_MESSAGE, getHttpErrorMessage } from './error-messages'

test('translates string and mixed-array messages without exposing unknown details', () => {
  expect(parseApiError(404, { message: 'Customer not found' }).messages).toEqual(['Cliente não encontrado.'])
  expect(parseApiError(400, { message: ['Customer not found', 'name must be a string', null, 12, {}, 'name must be a string'] }).messages)
    .toEqual(['Cliente não encontrado.', 'Confira os dados informados.'])
})

test('normalizes the gate and ignores backend text even for a known code', () => {
  const error = parseApiError(422, {
    message: 'Quote does not satisfy the sending requirements',
    errors: [
      { code: 'NO_CURTAINS', message: '<script>internal data</script>' },
      { code: 'FUTURE_GATE', message: 'Sensitive stack trace' },
      { code: '<script>', message: 'unsafe' },
      null, false, 'text', {},
    ],
  })
  expect(error.messages).toEqual(['O orçamento ainda não atende aos requisitos de envio.'])
  expect(error.violations).toEqual([
    { code: 'NO_CURTAINS', message: 'Inclua pelo menos uma cortina.' },
    { code: 'FUTURE_GATE', message: GENERIC_ERROR_MESSAGE },
  ])
})

test.each([undefined, null, false, [], '<html>trace</html>', 42, {},
  { message: {} }, { message: ['<script>unsafe</script>', undefined] },
  { message: 'toString', errors: {} },
])('uses a safe fallback for malformed payload %#', (payload) => {
  expect(parseApiError(500, payload)).toEqual({ messages: [GENERIC_ERROR_MESSAGE], violations: [] })
})

test('does not trust statusCode, error, stack or inherited payload fields', () => {
  const inherited = Object.create({ message: 'Customer not found', errors: [{ code: 'NO_CURTAINS' }] })
  expect(parseApiError(403, inherited)).toEqual({ messages: [getHttpErrorMessage(403)], violations: [] })
  expect(parseApiError(429, { statusCode: 401, error: 'internal', stack: 'internal', message: 'Too Many Requests' }).messages)
    .toEqual([getHttpErrorMessage(429)])
})
