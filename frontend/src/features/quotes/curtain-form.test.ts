import { expect, test } from 'vitest'
import { curtainFormDefaults, curtainFormPayload, curtainFormSchema, moneyInputValue } from './curtain-form'
import { quoteFixture } from './fixtures.test-support'
import { quoteFormDefaults, quoteFormPayload } from './quote-form'
import { parseMoneyInput } from './numeric-input'

test('keeps persisted identity separate from field-array keys and excludes all derived fields', () => {
  const value = curtainFormDefaults(quoteFixture.curtains[0])
  expect(value.serverId).toBe('curtain-1')
  expect(value).not.toHaveProperty('clientRef')
  expect(curtainFormPayload(value)).toEqual({ id: 'curtain-1', room: null, description: null, material: null,
    openingWidth: 2.123, borderValue: null, height: null, fabricFactor: null, notes: null })
  expect(value).not.toHaveProperty('sequence')
  expect(value).not.toHaveProperty('fabricQuantity')
})
test('new curtain has editable defaults, a client ref and no server identity', () => {
  const value = curtainFormDefaults()
  expect(value).toMatchObject({ borderValue: '0,15', fabricFactor: '3,5' })
  expect(value.clientRef).toMatch(/^new-curtain-\d+$/)
  expect(curtainFormSchema.safeParse(value).success).toBe(true)
  const payload = curtainFormPayload(value)
  expect(payload).not.toHaveProperty('id')
  expect(payload.clientRef).toBe(value.clientRef)
})
test('does not send untouched collections and sends explicit empty collections after removal', () => {
  const baseline = quoteFormDefaults(quoteFixture)
  const untouched = quoteFormPayload({ ...baseline, notes: 'changed' }, baseline)
  expect(untouched).not.toHaveProperty('curtains')
  expect(untouched).not.toHaveProperty('financialItems')
  expect(quoteFormPayload({ ...baseline, curtains: [] }, baseline)).toHaveProperty('curtains', [])
  expect(quoteFormPayload({ ...baseline, financialItems: [] }, baseline)).toHaveProperty('financialItems', [])
})
test('sends new curtains with clientRef and their items with curtainRef', () => {
  const baseline = quoteFormDefaults()
  const fresh = curtainFormDefaults()
  const values = { ...baseline, curtains: [fresh], financialItems: [
    { curtainKey: fresh.clientRef!, name: 'Novo', quantity: '', unit: '', unitPrice: '' },
  ] }
  const payload = quoteFormPayload(values, baseline)
  expect(payload.curtains?.[0]).toMatchObject({ clientRef: fresh.clientRef })
  expect(payload.curtains?.[0]).not.toHaveProperty('id')
  expect(payload.financialItems?.[0]).toEqual({ curtainRef: fresh.clientRef, name: 'Novo', quantity: null, unit: null, unitPriceCents: null })
})
test('existing items keep their id and server curtain association', () => {
  const baseline = quoteFormDefaults(quoteFixture)
  const values = { ...baseline, financialItems: [
    { ...baseline.financialItems[0], name: 'Tecido editado' },
    { curtainKey: null, name: 'Frete', quantity: '1', unit: 'un', unitPrice: '10,00' },
  ] }
  const payload = quoteFormPayload(values, baseline)
  expect(payload.financialItems).toEqual([
    { id: 'component-1', curtainId: 'curtain-1', name: 'Tecido editado', quantity: 1.123456, unit: null, unitPriceCents: 100 },
    { curtainId: null, name: 'Frete', quantity: 1, unit: 'un', unitPriceCents: 1000 },
  ])
})
test.each([
  ['openingWidth', '0'], ['height', '-1'], ['fabricFactor', '0'], ['borderValue', '-0,01'],
  ['openingWidth', '1,2345'], ['borderValue', '1000'], ['fabricFactor', '1000'],
] as const)('validates %s format and limits at submit', (field, invalid) => {
  const value = { ...curtainFormDefaults(), [field]: invalid }
  expect(curtainFormSchema.safeParse(value).success).toBe(false)
})
test('accepts zero border and a partial draft', () => {
  const value = { ...curtainFormDefaults(), borderValue: '0' }
  expect(curtainFormSchema.safeParse(value).success).toBe(true)
})
test.each([0, 1, 29, 100, 123456, 2147483647])('money defaults round-trip %s cents without floats', (cents) => {
  expect(parseMoneyInput(moneyInputValue(cents))).toBe(cents)
  expect(moneyInputValue(cents)).not.toContain('.')
})
