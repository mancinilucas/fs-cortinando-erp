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

test('retains only a safe numeric curtain locator from known gate messages', () => {
  const parsed = parseApiError(422, { errors: [
    { code: 'CURTAIN_HEIGHT_INVALID', message: 'Curtain 2 height must be greater than zero' },
    { code: 'COMPONENT_INVALID', message: 'Curtain 3 component "private name" must have quantity and unit price greater than zero' },
    { code: 'CURTAIN_ROOM_REQUIRED', message: 'private diagnostic' },
    { code: 'CURTAIN_FUTURE', message: 'Curtain 4 must have private data' },
  ] })
  expect(parsed.violations[0]).toMatchObject({ curtainSequence: 2, message: 'Confira a altura da cortina.' })
  expect(parsed.violations[1]).toMatchObject({ curtainSequence: 3 })
  expect(parsed.violations[2]).not.toHaveProperty('curtainSequence')
  expect(parsed.violations[3]).not.toHaveProperty('curtainSequence')
  expect(JSON.stringify(parsed)).not.toContain('private')
})
