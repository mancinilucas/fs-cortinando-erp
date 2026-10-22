import { expect, test } from 'vitest'
import { addOnsFormPayload, discountFormPayload, financialFormDefaults, financialFormSchema } from './financial-form'
import { quoteFormDefaults, quoteFormPayload } from './quote-form'
import { quoteFixture } from './fixtures.test-support'

test('financial inputs start without implicit add-ons or adjustment', () => {
  const values = financialFormDefaults()
  expect(values.generalAddOns).toEqual([])
  expect(values.commercialAdjustment).toBe('')
  expect(discountFormPayload(values)).toEqual({ type: 'NO_DISCOUNT', percentage: null, fixedAmountCents: null })
})
test('maps signed cents and add-on ids without totals or generated field-array keys', () => {
  const values = financialFormDefaults({ ...quoteFixture, commercialAdjustmentCents: -1,
    generalAddOns: [{ id: 'add-on-1', name: 'Frete', quantity: 1.123456, unit: 'un', unitPriceCents: 29, totalCents: 999 }] })
  expect(values.commercialAdjustment).toBe('-0,01')
  expect(addOnsFormPayload(values)).toEqual([{ id: 'add-on-1', name: 'Frete', quantity: 1.123456, unit: 'un', unitPriceCents: 29 }])
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
test('keeps untouched financial fields out of payload, clears adjustment with null and sends explicit empty add-ons', () => {
  const baseline = quoteFormDefaults({ ...quoteFixture, commercialAdjustmentCents: -1,
    generalAddOns: [{ id: 'a', name: 'Frete', quantity: null, unit: null, unitPriceCents: null, totalCents: null }] })
  const unchanged = quoteFormPayload({ ...baseline, notes: 'changed' }, baseline)
  expect(unchanged).not.toHaveProperty('generalAddOns')
  expect(unchanged).not.toHaveProperty('discount')
  expect(unchanged).not.toHaveProperty('commercialAdjustmentCents')
  const changed = quoteFormPayload({ ...baseline, generalAddOns: [], commercialAdjustment: '' }, baseline)
  expect(changed).toMatchObject({ generalAddOns: [], commercialAdjustmentCents: null })
})
test('no-discount clears a previously fixed discount and excludes inactive values', () => {
  const baseline = quoteFormDefaults({ ...quoteFixture, discount: { type: 'FIXED_AMOUNT', percentage: null, fixedAmountCents: 500 } })
  expect(quoteFormPayload({ ...baseline, discountType: 'NO_DISCOUNT' }, baseline).discount).toEqual({ type: 'NO_DISCOUNT', percentage: null, fixedAmountCents: null })
})

test.each([
  { quantity: '0', unitPrice: '1' }, { quantity: '-1', unitPrice: '1' },
  { quantity: '1,1234567', unitPrice: '1' }, { quantity: '1', unitPrice: '0' },
  { quantity: '1', unitPrice: '-1' }, { quantity: '1', unitPrice: '0,001' },
])('rejects invalid additional quantity or price %#', (fields) => {
  expect(financialFormSchema.safeParse({ ...financialFormDefaults(), generalAddOns: [{ name: 'Frete', unit: '', ...fields }] }).success).toBe(false)
})
test('allows incomplete draft add-ons with a name and accepts 100 percent without a local subtotal gate', () => {
  const values = { ...financialFormDefaults(), discountType: 'PERCENTAGE', discountPercentage: '100', generalAddOns: [{ name: 'Frete', quantity: '', unit: '', unitPrice: '' }] }
  expect(financialFormSchema.safeParse(values).success).toBe(true)
  expect(financialFormSchema.safeParse({ ...financialFormDefaults(), discountType: 'FIXED_AMOUNT', discountFixedAmount: '21474836,47' }).success).toBe(true)
})
