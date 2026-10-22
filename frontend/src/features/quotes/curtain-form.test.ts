import { expect, test } from 'vitest'
import { curtainFormDefaults, curtainFormPayload, curtainFormSchema, moneyInputValue } from './curtain-form'
import { quoteFixture } from './fixtures.test-support'
import { quoteFormDefaults, quoteFormPayload } from './quote-form'
import { parseMoneyInput } from './numeric-input'

test('keeps persisted identities separate from field-array keys and excludes all derived fields', () => {
  const value = curtainFormDefaults(quoteFixture.curtains[0])
  expect(value.serverId).toBe('curtain-1')
  expect(value.components[0].serverId).toBe('component-1')
  expect(curtainFormPayload(value)).toEqual({ id: 'curtain-1', room: null, description: null, material: null,
    openingWidth: 2.123, borderValue: null, height: null, fabricFactor: null, notes: null,
    components: [{ id: 'component-1', name: 'Tecido', quantity: 1.123456, unit: null, unitPriceCents: 100 }] })
  expect(value).not.toHaveProperty('sequence')
  expect(value).not.toHaveProperty('fabricQuantity')
})
test('new curtain has editable defaults, no identities and no implicit components', () => {
  const value = curtainFormDefaults()
  expect(value).toMatchObject({ borderValue: '0,15', fabricFactor: '3,5', components: [] })
  expect(curtainFormSchema.safeParse(value).success).toBe(true)
  expect(curtainFormPayload(value)).not.toHaveProperty('id')
})
test('does not send untouched curtains and sends an explicit empty collection after removing all', () => {
  const baseline = quoteFormDefaults(quoteFixture)
  expect(quoteFormPayload({ ...baseline, notes: 'changed' }, baseline)).not.toHaveProperty('curtains')
  expect(quoteFormPayload({ ...baseline, curtains: [] }, baseline)).toHaveProperty('curtains', [])
})
test('preserves array order and ids with new children and clearing optional fields', () => {
  const known = curtainFormDefaults(quoteFixture.curtains[0])
  const fresh = curtainFormDefaults()
  fresh.components.push({ name: 'Novo', quantity: '', unit: '', unitPrice: '' })
  const values = { ...quoteFormDefaults(), curtains: [fresh, known] }
  const payload = quoteFormPayload(values)
  expect(payload.curtains?.[0]).not.toHaveProperty('id')
  expect(payload.curtains?.[0].components?.[0]).toEqual({ name: 'Novo', quantity: null, unit: null, unitPriceCents: null })
  expect(payload.curtains?.[1].id).toBe('curtain-1')
})
test.each([
  ['openingWidth', '0'], ['height', '-1'], ['fabricFactor', '0'], ['borderValue', '-0,01'],
  ['openingWidth', '1,2345'], ['borderValue', '1000'], ['fabricFactor', '1000'],
] as const)('validates %s format and limits at submit', (field, invalid) => {
  const value = { ...curtainFormDefaults(), [field]: invalid }
  expect(curtainFormSchema.safeParse(value).success).toBe(false)
})
test('accepts zero border and partial draft but requires each added component name', () => {
  const value = { ...curtainFormDefaults(), borderValue: '0' }
  expect(curtainFormSchema.safeParse(value).success).toBe(true)
  value.components.push({ name: ' ', unit: '', quantity: '', unitPrice: '' })
  expect(curtainFormSchema.safeParse(value).success).toBe(false)
})
test.each([0, 1, 29, 100, 123456, 2147483647])('money defaults round-trip %s cents without floats', (cents) => {
  expect(parseMoneyInput(moneyInputValue(cents))).toBe(cents)
  expect(moneyInputValue(cents)).not.toContain('.')
})
