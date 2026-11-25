import { expect, test } from 'vitest'
import {
  discountFormPayload, financialFormDefaults, financialFormSchema, financialItemFormDefaults,
  financialItemFormPayload, financialItemFormSchema,
} from './financial-form'
import { quoteFormDefaults, quoteFormPayload } from './quote-form'
import { curtainFormDefaults } from './curtain-form'
import { quoteFixture } from './fixtures.test-support'

test('financial inputs start without adjustment and with no discount', () => {
  const values = financialFormDefaults()
  expect(values.commercialAdjustment).toBe('')
  expect(discountFormPayload(values)).toEqual({ type: 'NO_DISCOUNT', percentage: null, fixedAmountCents: null })
})
test('maps signed cents and financial item identity without totals or generated field-array keys', () => {
  const item = { id: 'add-on-1', curtainId: null, name: 'Frete', quantity: 1.123456, unit: 'un', unitPriceCents: 29, totalCents: 999 }
  expect(financialItemFormDefaults(item)).toEqual({ serverId: 'add-on-1', curtainKey: null, name: 'Frete', quantity: '1,123456', unit: 'un', unitPrice: '0,29' })
  const curtainItem = financialItemFormDefaults({ ...item, curtainId: 'curtain-1' })
  expect(curtainItem.curtainKey).toBe('curtain-1')
  const values = financialFormDefaults({ ...quoteFixture, commercialAdjustmentCents: -1 })
  expect(values.commercialAdjustment).toBe('-0,01')
})
test('associates items with the general composition, an existing curtain or a new curtain', () => {
  const item = { name: 'Frete', quantity: '1', unit: '', unitPrice: '10,00' }
  const existing = { ...curtainFormDefaults(), serverId: 'curtain-1' }
  expect(financialItemFormPayload({ ...item, curtainKey: null }, null)).toMatchObject({ curtainId: null, name: 'Frete', unitPriceCents: 1000 })
  expect(financialItemFormPayload({ ...item, curtainKey: 'curtain-1' }, existing)).toMatchObject({ curtainId: 'curtain-1' })
  const fresh = curtainFormDefaults()
  expect(financialItemFormPayload({ ...item, curtainKey: fresh.clientRef! }, fresh)).toMatchObject({ curtainRef: fresh.clientRef })
  expect(financialItemFormPayload({ ...item, serverId: 'item-1', curtainKey: 'curtain-1' }, existing)).toMatchObject({ id: 'item-1', curtainId: 'curtain-1' })
})
test('sends only the active discount value and ignores disabled stale text', () => {
  const values = { ...financialFormDefaults(), discountType: 'PERCENTAGE' as const, discountPercentage: '12,34', discountFixedAmount: 'invalid' }
  expect(financialFormSchema.safeParse(values).success).toBe(true)
  expect(discountFormPayload(values)).toEqual({ type: 'PERCENTAGE', percentage: 12.34, fixedAmountCents: null })
  const fixed = { ...values, discountType: 'FIXED_AMOUNT' as const, discountFixedAmount: '0,29', discountPercentage: 'invalid' }
  expect(financialFormSchema.safeParse(fixed).success).toBe(true)
  expect(discountFormPayload(fixed)).toEqual({ type: 'FIXED_AMOUNT', percentage: null, fixedAmountCents: 29 })
})
test.each(['', '0', '-1', '100,01', '1,234'])('rejects invalid active percentage %s', (discountPercentage) => {
  expect(financialFormSchema.safeParse({ ...financialFormDefaults(), discountType: 'PERCENTAGE', discountPercentage }).success).toBe(false)
})
test.each(['', '0', '-1', '0,001', '21474836,48'])('rejects invalid fixed discount %s', (discountFixedAmount) => {
  expect(financialFormSchema.safeParse({ ...financialFormDefaults(), discountType: 'FIXED_AMOUNT', discountFixedAmount }).success).toBe(false)
})
test.each(['-21474836,48', '21474836,47', '-0,01', '+1,13', '0', ''])('accepts signed adjustment %s within the HTTP contract', (commercialAdjustment) => {
  expect(financialFormSchema.safeParse({ ...financialFormDefaults(), commercialAdjustment }).success).toBe(true)
})
test('keeps untouched financial fields out of payload and sends the complete collection when one item changes', () => {
  const baseline = quoteFormDefaults(quoteFixture)
  const unchanged = quoteFormPayload({ ...baseline, notes: 'changed' }, baseline)
  expect(unchanged).not.toHaveProperty('financialItems')
  expect(unchanged).not.toHaveProperty('discount')
  expect(unchanged).not.toHaveProperty('commercialAdjustmentCents')
  const added = { ...baseline, financialItems: [
    ...baseline.financialItems,
    { curtainKey: null, name: 'Frete', quantity: '1', unit: 'un', unitPrice: '10,00' },
  ] }
  const changed = quoteFormPayload(added, baseline)
  expect(changed.financialItems).toEqual([
    { id: 'component-1', curtainId: 'curtain-1', name: 'Tecido', quantity: 1.123456, unit: null, unitPriceCents: 100 },
    { curtainId: null, name: 'Frete', quantity: 1, unit: 'un', unitPriceCents: 1000 },
  ])
  const adjusted = quoteFormDefaults({ ...quoteFixture, commercialAdjustmentCents: -1 })
  expect(quoteFormPayload({ ...adjusted, commercialAdjustment: '' }, adjusted)).toMatchObject({ commercialAdjustmentCents: null })
})
test('no-discount clears a previously fixed discount and excludes inactive values', () => {
  const baseline = quoteFormDefaults({ ...quoteFixture, discount: { type: 'FIXED_AMOUNT', percentage: null, fixedAmountCents: 500 } })
  expect(quoteFormPayload({ ...baseline, discountType: 'NO_DISCOUNT' }, baseline).discount).toEqual({ type: 'NO_DISCOUNT', percentage: null, fixedAmountCents: null })
})

test.each([
  { quantity: '0', unitPrice: '1' }, { quantity: '-1', unitPrice: '1' },
  { quantity: '1,1234567', unitPrice: '1' }, { quantity: '1', unitPrice: '0' },
  { quantity: '1', unitPrice: '-1' }, { quantity: '1', unitPrice: '0,001' },
])('rejects invalid financial item quantity or price %#', (fields) => {
  expect(financialItemFormSchema.safeParse({ curtainKey: null, name: 'Frete', unit: '', ...fields }).success).toBe(false)
})
test('allows incomplete draft items with a name and requires the name', () => {
  expect(financialItemFormSchema.safeParse({ curtainKey: null, name: 'Frete', quantity: '', unit: '', unitPrice: '' }).success).toBe(true)
  expect(financialItemFormSchema.safeParse({ curtainKey: null, name: ' ', quantity: '', unit: '', unitPrice: '' }).success).toBe(false)
  expect(financialFormSchema.safeParse({ ...financialFormDefaults(), discountType: 'PERCENTAGE', discountPercentage: '100' }).success).toBe(true)
  expect(financialFormSchema.safeParse({ ...financialFormDefaults(), discountType: 'FIXED_AMOUNT', discountFixedAmount: '21474836,47' }).success).toBe(true)
})
