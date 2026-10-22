import { expect, test } from 'vitest'
import { customerFormDefaults, customerFormPatch, customerFormPayload, customerFormSchema } from './customer-form'
import { customerFixture } from './fixtures.test-support'

const values = { ...customerFormDefaults(), name: 'Ana', phone: 'telefone textual' }
test('requires name and phone without inventing phone validation', () => {
  expect(customerFormSchema.safeParse(customerFormDefaults()).success).toBe(false)
  expect(customerFormSchema.safeParse(values).success).toBe(true)
})
test('accepts CPF/CNPJ length without check-digit validation', () => {
  expect(customerFormSchema.safeParse({ ...values, taxId: '111.111.111-11' }).success).toBe(true)
  expect(customerFormSchema.safeParse({ ...values, taxId: '11.111.111/1111-11' }).success).toBe(true)
  expect(customerFormSchema.safeParse({ ...values, taxId: '123' }).success).toBe(false)
})
test('validates email only when populated', () => {
  expect(customerFormSchema.safeParse({ ...values, email: ' ' }).success).toBe(true)
  expect(customerFormSchema.safeParse({ ...values, email: 'invalid' }).success).toBe(false)
})
test('requires the full address only when enabled and accepts textual number', () => {
  expect(customerFormSchema.safeParse({ ...values, postalCode: 'invalid' }).success).toBe(true)
  expect(customerFormSchema.safeParse({ ...values, addressEnabled: true }).success).toBe(false)
  const complete = { ...customerFormDefaults(customerFixture), number: 's/n', postalCode: '12345-678', state: 'sp' }
  expect(customerFormSchema.safeParse(complete).success).toBe(true)
  expect(customerFormPayload(complete).address).toMatchObject({ number: 's/n', postalCode: '12345-678', state: 'sp' })
})
test('maps blank optional values to null and preserves nonblank input for backend normalization', () => {
  expect(customerFormPayload({ ...values, name: '  Ana  ', email: ' ', notes: '' })).toEqual({
    name: '  Ana  ', phone: values.phone, email: null, taxId: null, notes: null, address: null,
  })
})
test('produces no PATCH when unchanged and only changed scalar fields otherwise', () => {
  const original = customerFormDefaults(customerFixture)
  expect(customerFormPatch(original, original)).toEqual({})
  expect(customerFormPatch({ ...original, name: 'Updated' }, original)).toEqual({ name: 'Updated' })
  expect(customerFormPatch({ ...original, email: '' }, { ...original, email: 'old@example.test' })).toEqual({ email: null })
})
test('replaces changed address completely and clears it explicitly', () => {
  const original = customerFormDefaults(customerFixture)
  expect(customerFormPatch({ ...original, city: 'Campinas' }, original)).toEqual({ address: { ...customerFixture.address, city: 'Campinas' } })
  expect(customerFormPatch({ ...original, addressEnabled: false }, original)).toEqual({ address: null })
})
