import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, test } from 'vitest'
import { createAppQueryClient } from '@/app/query-client'
import { customerKeys } from '@/features/customers/query-keys'
import { dashboardQueryKey } from '@/features/dashboard/use-dashboard'
import { server } from '@/shared/test/server'
import { quoteFixture } from './fixtures.test-support'
import { quoteKeys } from './query-keys'
import { useQuoteLifecycle } from './use-quote-lifecycle'

function setup() {
  const client = createAppQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, wrapper }
}
test('successful actions replace detail and invalidate all dependent resources without optimistic writes', async () => {
  const saved = { ...quoteFixture, status: 'SENT' as const }
  server.use(http.post('*/orcamentos/quote-1/enviar', () => HttpResponse.json(saved)))
  const { client, wrapper } = setup()
  client.setQueryData(quoteKeys.detail('quote-1'), quoteFixture)
  const keys = [quoteKeys.list(), quoteKeys.history('quote-1'), customerKeys.history('customer-1'), dashboardQueryKey]
  for (const key of keys) client.setQueryData(key, [])
  const view = renderHook(() => useQuoteLifecycle(quoteFixture), { wrapper })
  expect(client.getQueryData(quoteKeys.detail('quote-1'))).toEqual(quoteFixture)
  await act(async () => { await view.result.current.mutateAsync({ action: 'send' }) })
  expect(client.getQueryData(quoteKeys.detail('quote-1'))).toEqual(saved)
  for (const key of keys) expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  view.unmount(); client.clear()
})
test('draft deletion removes detail/history and invalidates lists, customer history and dashboard', async () => {
  server.use(http.delete('*/orcamentos/quote-1', () => new HttpResponse(null, { status: 204 })))
  const { client, wrapper } = setup()
  client.setQueryData(quoteKeys.detail('quote-1'), quoteFixture)
  client.setQueryData(quoteKeys.history('quote-1'), [])
  const keys = [quoteKeys.list(), customerKeys.history('customer-1'), dashboardQueryKey]
  for (const key of keys) client.setQueryData(key, [])
  const view = renderHook(() => useQuoteLifecycle(quoteFixture), { wrapper })
  await act(async () => { await view.result.current.mutateAsync({ action: 'delete' }) })
  expect(client.getQueryData(quoteKeys.detail('quote-1'))).toBeUndefined()
  expect(client.getQueryData(quoteKeys.history('quote-1'))).toBeUndefined()
  for (const key of keys) expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  view.unmount(); client.clear()
})
test('failed gates preserve confirmed state and do not invalidate dependent resources', async () => {
  server.use(http.post('*/orcamentos/quote-1/enviar', () => new HttpResponse(null, { status: 422 })))
  const { client, wrapper } = setup()
  client.setQueryData(quoteKeys.detail('quote-1'), quoteFixture)
  client.setQueryData(quoteKeys.list(), [])
  const view = renderHook(() => useQuoteLifecycle(quoteFixture), { wrapper })
  await act(async () => { await expect(view.result.current.mutateAsync({ action: 'send' })).rejects.toMatchObject({ status: 422 }) })
  expect(client.getQueryData(quoteKeys.detail('quote-1'))).toEqual(quoteFixture)
  expect(client.getQueryState(quoteKeys.list())?.isInvalidated).toBe(false)
  view.unmount(); client.clear()
})

test('failed deletion including 404 preserves caches and propagates failure', async () => {
  server.use(http.delete('*/orcamentos/quote-1', () => new HttpResponse(null, { status: 404 })))
  const { client, wrapper } = setup()
  client.setQueryData(quoteKeys.detail('quote-1'), quoteFixture)
  client.setQueryData(quoteKeys.history('quote-1'), [])
  const view = renderHook(() => useQuoteLifecycle(quoteFixture), { wrapper })
  await act(async () => { await expect(view.result.current.mutateAsync({ action: 'delete' })).rejects.toMatchObject({ status: 404 }) })
  expect(client.getQueryData(quoteKeys.detail('quote-1'))).toEqual(quoteFixture)
  expect(client.getQueryData(quoteKeys.history('quote-1'))).toEqual([])
  view.unmount(); client.clear()
})
