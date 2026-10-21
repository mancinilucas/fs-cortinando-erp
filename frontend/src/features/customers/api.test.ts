import { http, HttpResponse } from 'msw'
import { expect, test, vi } from 'vitest'
import { server } from '@/shared/test/server'
import { createCustomer, deleteCustomer, getCustomer, getCustomerQuotes, searchCustomers, updateCustomer } from './api'
import { customerFixture, customerQuotesFixture } from './fixtures.test-support'

const summary = { id: customerFixture.id, name: customerFixture.name, phone: customerFixture.phone, email: null }

test('sends literal search text as one encoded parameter and preserves server ordering/projection', async () => {
  const search = 'Ána & status=DELETED + %_'
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
  const items = [{ ...summary, id: 'b' }, { ...summary, id: 'a' }]
  server.use(http.get('*/clientes', ({ request }) => {
    const url = new URL(request.url)
    expect([...url.searchParams]).toEqual([['search', search]])
    return HttpResponse.json(items.map((item) => ({ ...item, deletedAt: null, notes: 'private' })))
  }))
  await expect(searchCustomers(search)).resolves.toEqual(items)
  expect(fetchSpy).toHaveBeenCalledWith(`/clientes?${new URLSearchParams({ search })}`, expect.objectContaining({ credentials: 'include' }))
})
test('empty search accepts an empty server list', async () => {
  server.use(http.get('*/clientes', ({ request }) => {
    expect(new URL(request.url).searchParams.get('search')).toBe('')
    return HttpResponse.json([])
  }))
  await expect(searchCustomers()).resolves.toEqual([])
})
test('loads the full detail and strips internal fields', async () => {
  server.use(http.get('*/clientes/customer-1', () => HttpResponse.json({ ...customerFixture, deletedAt: 'private' })))
  await expect(getCustomer('customer-1')).resolves.toEqual(customerFixture)
})
test('loads quote history without recalculating expiration, dates or monetary values', async () => {
  server.use(http.get('*/clientes/customer-1/orcamentos', () => HttpResponse.json(customerQuotesFixture)))
  await expect(getCustomerQuotes('customer-1')).resolves.toEqual(customerQuotesFixture)
})
test('POST sends only public payload fields, preserving values for backend normalization', async () => {
  server.use(http.post('*/clientes', async ({ request }) => {
    expect(await request.json()).toEqual({ name: '  Ana  ', phone: '(11) 91234-5678', email: null, address: customerFixture.address })
    return HttpResponse.json(customerFixture, { status: 201 })
  }))
  const payload = { name: '  Ana  ', phone: '(11) 91234-5678', email: null, address: customerFixture.address, id: 'injected', createdAt: 'private' }
  await expect(createCustomer(payload)).resolves.toEqual(customerFixture)
})
test('PATCH sends only supplied fields and preserves null clearing', async () => {
  server.use(http.patch('*/clientes/customer-1', async ({ request }) => {
    expect(await request.json()).toEqual({ email: null, address: null })
    return HttpResponse.json({ ...customerFixture, address: null })
  }))
  await expect(updateCustomer('customer-1', { email: null, address: null })).resolves.toMatchObject({ address: null })
})
test('PATCH sends a changed address as a complete block', async () => {
  server.use(http.patch('*/clientes/customer-1', async ({ request }) => {
    expect(await request.json()).toEqual({ address: customerFixture.address })
    return HttpResponse.json(customerFixture)
  }))
  await updateCustomer('customer-1', { address: customerFixture.address })
})
test.each([{}, { name: null }, { phone: null }, { address: { city: 'São Paulo' } }, { notes: undefined }])('rejects invalid PATCH %# before any request', async (payload) => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
  // Exercise the runtime boundary with intentionally invalid caller input.
  await expect(async () => updateCustomer('customer-1', payload as never)).rejects.toThrow()
  expect(fetchSpy).not.toHaveBeenCalled()
})
test('DELETE accepts an empty 204 and sends no body', async () => {
  server.use(http.delete('*/clientes/customer-1', async ({ request }) => {
    expect(await request.text()).toBe('')
    return new HttpResponse(null, { status: 204 })
  }))
  await expect(deleteCustomer('customer-1')).resolves.toBeUndefined()
})
test.each([401, 403, 404, 409, 429, 500])('propagates HTTP %i without retries or delete-specific UX policies', async (status) => {
  const handler = vi.fn(() => new HttpResponse(null, { status }))
  server.use(http.delete('*/clientes/customer-1', handler))
  await expect(deleteCustomer('customer-1')).rejects.toMatchObject({ status })
  expect(handler).toHaveBeenCalledOnce()
})
test('propagates network failure', async () => {
  server.use(http.get('*/clientes/customer-1', () => HttpResponse.error()))
  await expect(getCustomer('customer-1')).rejects.toBeInstanceOf(TypeError)
})
test.each([null, {}, { ...customerFixture, phone: 123 }, { ...customerFixture, address: { city: 'São Paulo' } }])('rejects malformed detail %#', async (body) => {
  server.use(http.get('*/clientes/customer-1', () => HttpResponse.json(body)))
  await expect(getCustomer('customer-1')).rejects.toMatchObject({ name: 'ApiError' })
})
test('rejects missing detail instead of inventing data', async () => {
  server.use(http.get('*/clientes/customer-1', () => new HttpResponse(null, { status: 204 })))
  await expect(getCustomer('customer-1')).rejects.toMatchObject({ status: 204 })
})
test('encodes customer IDs into a single path component', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(HttpResponse.json(customerFixture))
  await getCustomer('a/b?x=1#fragment')
  expect(fetchSpy).toHaveBeenCalledWith('/clientes/a%2Fb%3Fx%3D1%23fragment', expect.anything())
})
