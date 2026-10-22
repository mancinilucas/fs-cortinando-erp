import { http, HttpResponse } from 'msw'
import { expect, test, vi } from 'vitest'
import { server } from '@/shared/test/server'
import { quoteSummariesQueryKey, customerKeys } from '@/features/customers/query-keys'
import { quoteKeys } from './query-keys'
import * as api from './api'
import { quoteFixture, quoteSummaryFixture } from './fixtures.test-support'

const history = [{ id: 'event-1', eventType: 'QUOTE_EDITED', occurredAt: quoteFixture.createdAt, details: { future: ['opaque'] } }]

test('encodes literal search and EXPIRED filter and preserves server ordering and values', async () => {
  const search = 'Ána & status=DRAFT + %_'
  const summaries = [{ ...quoteSummaryFixture, id: 'z' }, { ...quoteSummaryFixture, id: 'a' }]
  const fetch = vi.spyOn(globalThis, 'fetch')
  server.use(http.get('*/orcamentos', ({ request }) => {
    expect([...new URL(request.url).searchParams]).toEqual([['search', search], ['status', 'EXPIRED']])
    return HttpResponse.json(summaries)
  }))
  await expect(api.searchQuotes({ search, status: 'EXPIRED' })).resolves.toEqual(summaries)
  expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ credentials: 'include' }))
})
test('supports unfiltered empty lists and rejects unknown search status', async () => {
  server.use(http.get('*/orcamentos', ({ request }) => {
    expect(new URL(request.url).search).toBe('')
    return HttpResponse.json([])
  }))
  await expect(api.searchQuotes()).resolves.toEqual([])
  expect(() => api.searchQuotes({ status: 'INVALID' } as never)).toThrow()
})
test('decodes detail without recomputing totals, measures or derived flags', async () => {
  server.use(http.get('*/orcamentos/quote-1', () => HttpResponse.json({ ...quoteFixture, internal: 'private' })))
  await expect(api.getQuote('quote-1')).resolves.toEqual(quoteFixture)
})
test('preserves history order and opaque details including null', async () => {
  const events = [...history, { ...history[0], id: 'event-2', details: null }]
  server.use(http.get('*/orcamentos/quote-1/historico', () => HttpResponse.json(events)))
  await expect(api.getQuoteHistory('quote-1')).resolves.toEqual(events)
})
test('creates from customer context with an empty draft payload', async () => {
  server.use(http.post('*/clientes/customer-1/orcamentos', async ({ request }) => {
    expect(await request.json()).toEqual({})
    return HttpResponse.json(quoteFixture, { status: 201 })
  }))
  await expect(api.createQuote('customer-1')).resolves.toEqual(quoteFixture)
})
test('write whitelist excludes system and derived fields throughout nested create payloads', async () => {
  server.use(http.post('*/clientes/customer-1/orcamentos', async ({ request }) => {
    expect(await request.json()).toEqual({ curtains: [{ room: 'Sala', components: [{ name: 'Tecido', quantity: 1.123456, unitPriceCents: 100 }] }], generalAddOns: [{ name: 'Frete' }] })
    return HttpResponse.json(quoteFixture, { status: 201 })
  }))
  await api.createQuote('customer-1', {
    id: 'injected', customerId: 'wrong', status: 'CONFIRMED', totals: quoteFixture.totals,
    curtains: [{ id: 'ignored', sequence: 99, finalWidth: 100, fabricQuantity: 100, totalCents: 100,
      room: 'Sala', components: [{ id: 'ignored', name: 'Tecido', quantity: 1.123456, unitPriceCents: 100, totalCents: 100 }] }],
    generalAddOns: [{ name: 'Frete', totalCents: 100 }],
  } as never)
})
test('PATCH preserves omitted scalars, null clearing, complete array order and existing child ids', async () => {
  const patch = { notes: null, discount: null, commercialAdjustmentCents: -123, installationAddress: { city: null }, curtains: [
    { id: 'curtain-2', components: [] }, { id: 'curtain-1', components: [{ id: 'component-1', quantity: null }, { name: 'Novo' }] }, {},
  ], generalAddOns: [] }
  server.use(http.patch('*/orcamentos/quote-1', async ({ request }) => {
    expect(await request.json()).toEqual(patch)
    return HttpResponse.json(quoteFixture)
  }))
  await expect(api.updateQuote('quote-1', patch)).resolves.toEqual(quoteFixture)
})
test('PATCH does not synthesize collections or fields on an empty patch', async () => {
  server.use(http.patch('*/orcamentos/quote-1', async ({ request }) => {
    expect(await request.json()).toEqual({})
    return HttpResponse.json(quoteFixture)
  }))
  await api.updateQuote('quote-1', {})
})
const instant = '2026-10-01T09:00:00-03:00'
test.each([
  ['enviar', () => api.sendQuote('quote-1'), {}],
  ['enviar', () => api.sendQuote('quote-1', { validUntil: null }), { validUntil: null }],
  ['enviar', () => api.sendQuote('quote-1', { validUntil: instant }), { validUntil: instant }],
  ['renovar', () => api.renewQuote('quote-1', { validUntil: instant }), { validUntil: instant }],
  ['cancelar', () => api.cancelQuote('quote-1', { reason: null }), { reason: null }],
  ['cancelar', () => api.cancelQuote('quote-1'), {}],
  ['confirmar', () => api.confirmQuote('quote-1'), undefined],
  ['reabrir', () => api.reopenQuote('quote-1'), undefined],
  ['iniciar-producao', () => api.startQuoteProduction('quote-1'), undefined],
  ['concluir', () => api.completeQuote('quote-1'), undefined],
] as const)('uses the dedicated lifecycle endpoint %s %#', async (route, call, body) => {
  server.use(http.post(`*/orcamentos/quote-1/${route}`, async ({ request }) => {
    expect(await request.text()).toBe(body === undefined ? '' : JSON.stringify(body))
    return HttpResponse.json(quoteFixture)
  }))
  await expect(call()).resolves.toEqual(quoteFixture)
})
test('PUT installation preserves the supplied ISO instant, including past instants', async () => {
  server.use(http.put('*/orcamentos/quote-1/instalacao', async ({ request }) => {
    expect(await request.json()).toEqual({ scheduledInstallationAt: instant })
    return HttpResponse.json(quoteFixture)
  }))
  await expect(api.scheduleInstallation('quote-1', { scheduledInstallationAt: instant })).resolves.toEqual(quoteFixture)
})
test.each([
  ['/orcamentos/quote-1', () => api.deleteQuote('quote-1')],
  ['/orcamentos/quote-1/instalacao', () => api.removeInstallation('quote-1')],
] as const)('accepts DELETE 204 without a response body at %s', async (path, call) => {
  server.use(http.delete(`*${path}`, async ({ request }) => {
    expect(await request.text()).toBe('')
    return new HttpResponse(null, { status: 204 })
  }))
  await expect(call()).resolves.toBeUndefined()
})
test.each([
  ['pdf', api.getCommercialPdf], ['ordem-producao', api.getProductionOrder],
] as const)('fetches %s bytes on demand without document caching', async (route, call) => {
  const handler = vi.fn(({ request }: { request: Request }) => {
    expect(request.headers.get('Accept')).toBe('application/pdf')
    return new HttpResponse('%PDF-1.7', { headers: { 'Content-Type': 'application/pdf' } })
  })
  server.use(http.get(`*/orcamentos/quote-1/${route}`, handler))
  expect(handler).not.toHaveBeenCalled()
  expect((await call('quote-1')).type).toBe('application/pdf')
  await call('quote-1')
  expect(handler).toHaveBeenCalledTimes(2)
})
test.each([404, 409, 422, 500])('propagates HTTP %s without retry or swallowing violations', async (status) => {
  const handler = vi.fn(() => HttpResponse.json({ message: 'private diagnostic' }, { status }))
  server.use(http.get('*/orcamentos/quote-1', handler))
  await expect(api.getQuote('quote-1')).rejects.toMatchObject({ status })
  expect(handler).toHaveBeenCalledOnce()
})
test('parses JSON document errors before exposing a Blob and does not retry', async () => {
  const handler = vi.fn(() => HttpResponse.json({ message: 'Business data is not configured' }, { status: 409 }))
  server.use(http.get('*/orcamentos/quote-1/pdf', handler))
  await expect(api.getCommercialPdf('quote-1')).rejects.toMatchObject({ status: 409 })
  expect(handler).toHaveBeenCalledOnce()
})
test.each([undefined, {}, { ...quoteFixture, totals: {} }, { ...quoteFixture, status: 'EXPIRED' }])('rejects malformed detail %# safely', async (body) => {
  server.use(http.get('*/orcamentos/quote-1', () => body === undefined ? new HttpResponse(null, { status: 204 }) : HttpResponse.json(body)))
  await expect(api.getQuote('quote-1')).rejects.toMatchObject({ name: 'ApiError' })
})
test('rejects non-PDF successful responses', async () => {
  server.use(http.get('*/orcamentos/quote-1/pdf', () => HttpResponse.json({ secret: 'private' })))
  await expect(api.getCommercialPdf('quote-1')).rejects.toMatchObject({ name: 'ApiError' })
})
test('encodes ids as a single segment and forwards cancellation', async () => {
  const controller = new AbortController()
  const fetch = vi.spyOn(globalThis, 'fetch')
  server.use(http.get('*/orcamentos/:id', () => HttpResponse.json(quoteFixture)))
  await api.getQuote('a/b ?#', controller.signal)
  expect(fetch).toHaveBeenCalledWith('/orcamentos/a%2Fb%20%3F%23', expect.objectContaining({ signal: controller.signal }))
  controller.abort()
  await expect(api.getQuote('quote-1', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
})
test.each(['', '.', '..'])('rejects invalid resource id %s before fetch', (id) => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  expect(() => api.getQuote(id)).toThrow(TypeError)
  expect(fetch).not.toHaveBeenCalled()
})
test('query keys separate filters and resources, preserving the customer invalidation prefix', () => {
  expect(quoteKeys.lists()).toEqual(quoteSummariesQueryKey)
  expect(quoteKeys.list()).toEqual(quoteKeys.list({ search: '' }))
  expect(quoteKeys.list({ search: 'Ana', status: 'SENT' })).not.toEqual(quoteKeys.list({ search: 'Ana', status: 'EXPIRED' }))
  expect(quoteKeys.detail('q')).not.toEqual(quoteKeys.history('q'))
  expect(quoteKeys.history('q')).not.toEqual(customerKeys.history('q'))
})

test.each([
  { generalAddOns: [{ quantity: 1 }] }, { curtains: [{ components: [{ id: 'known', name: null }] }] },
  { curtains: null }, { commercialAdjustmentCents: 1.5 },
] as const)('rejects malformed writes %# before sending a request', (payload) => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  expect(() => api.updateQuote('quote-1', payload as never)).toThrow()
  expect(fetch).not.toHaveBeenCalled()
})
test('PATCH strips derived fields while retaining editable child identity', async () => {
  server.use(http.patch('*/orcamentos/quote-1', async ({ request }) => {
    expect(await request.json()).toEqual({ curtains: [{ id: 'curtain-1', components: [{ id: 'component-1', unitPriceCents: null }] }] })
    return HttpResponse.json(quoteFixture)
  }))
  await api.updateQuote('quote-1', { status: 'SENT', customerId: 'wrong', expired: true,
    curtains: [{ id: 'curtain-1', sequence: 5, finalWidth: 999, totalCents: 1,
      components: [{ id: 'component-1', unitPriceCents: null, totalCents: 1 }] }],
  } as never)
})
test('preserves safe send-gate violations from the HTTP client', async () => {
  server.use(http.post('*/orcamentos/quote-1/enviar', () => HttpResponse.json({ errors: [{ code: 'NO_CURTAINS', message: 'private diagnostic' }] }, { status: 422 })))
  await expect(api.sendQuote('quote-1')).rejects.toMatchObject({ status: 422, violations: [{ code: 'NO_CURTAINS', message: 'Inclua pelo menos uma cortina.' }] })
})
test('propagates network failures without retry', async () => {
  const handler = vi.fn(() => HttpResponse.error())
  server.use(http.get('*/orcamentos/quote-1', handler))
  await expect(api.getQuote('quote-1')).rejects.toThrow()
  expect(handler).toHaveBeenCalledOnce()
})
