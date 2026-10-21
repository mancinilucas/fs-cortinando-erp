import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, test, vi } from 'vitest'
import { server } from '@/shared/test/server'
import { createAppQueryClient } from '@/app/query-client'
import { customerFixture, customerQuotesFixture } from './fixtures.test-support'
import { customerKeys, quoteSummariesQueryKey } from './query-keys'
import { useCreateCustomer, useCustomer, useCustomerQuotes, useCustomers, useDeleteCustomer, useUpdateCustomer } from './hooks'

function setup() {
  const client = createAppQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, wrapper }
}
test('deduplicates list consumers and separates different search terms in cache', async () => {
  const handler = vi.fn(() => HttpResponse.json([]))
  server.use(http.get('*/clientes', handler))
  const { client, wrapper } = setup()
  const view = renderHook(({ search }) => [useCustomers(search), useCustomers(search)], { wrapper, initialProps: { search: 'Ana' } })
  await waitFor(() => expect(view.result.current.every((query) => query.isSuccess)).toBe(true))
  expect(handler).toHaveBeenCalledOnce()
  view.rerender({ search: 'Ána' })
  await waitFor(() => expect(view.result.current.every((query) => query.isSuccess)).toBe(true))
  expect(handler).toHaveBeenCalledTimes(2)
  expect(client.getQueryData(customerKeys.list('Ana'))).toEqual([])
  expect(client.getQueryData(customerKeys.list('Ána'))).toEqual([])
  view.unmount(); client.clear()
})
test('keeps detail and history idle without an ID and reads separate resource keys when supplied', async () => {
  server.use(http.get('*/clientes/customer-1', () => HttpResponse.json(customerFixture)), http.get('*/clientes/customer-1/orcamentos', () => HttpResponse.json(customerQuotesFixture)))
  const { client, wrapper } = setup()
  const view = renderHook(({ id }: { id: string | undefined }) => ({ detail: useCustomer(id), history: useCustomerQuotes(id) }), { wrapper, initialProps: { id: undefined } as { id: string | undefined } })
  expect(view.result.current.detail.fetchStatus).toBe('idle')
  expect(view.result.current.history.fetchStatus).toBe('idle')
  view.rerender({ id: 'customer-1' })
  await waitFor(() => expect(view.result.current.history.isSuccess && view.result.current.detail.isSuccess).toBe(true))
  expect(client.getQueryData(customerKeys.detail('customer-1'))).toEqual(customerFixture)
  expect(client.getQueryData(customerKeys.history('customer-1'))).toEqual(customerQuotesFixture)
  view.unmount(); client.clear()
})
test('cancels abandoned list requests', async () => {
  let signal: AbortSignal | undefined
  server.use(http.get('*/clientes', ({ request }) => { signal = request.signal; return new Promise<Response>(() => {}) }))
  const { client, wrapper } = setup()
  const view = renderHook(() => useCustomers('Ana'), { wrapper })
  await waitFor(() => expect(signal).toBeDefined())
  view.unmount()
  await waitFor(() => expect(signal?.aborted).toBe(true))
  client.clear()
})
test.each(['create', 'update', 'delete'] as const)('%s invalidates customers, quote summaries and dashboard only after success', async (operation) => {
  const updated = { ...customerFixture, name: 'Updated name' }
  server.use(http.post('*/clientes', () => HttpResponse.json(updated, { status: 201 })), http.patch('*/clientes/customer-1', () => HttpResponse.json(updated)), http.delete('*/clientes/customer-1', () => new HttpResponse(null, { status: 204 })))
  const { client, wrapper } = setup()
  client.setQueryData(customerKeys.list(''), [])
  client.setQueryData(customerKeys.detail('customer-1'), customerFixture)
  client.setQueryData(customerKeys.history('customer-1'), customerQuotesFixture)
  client.setQueryData(quoteSummariesQueryKey, [])
  client.setQueryData(['dashboard'], {})
  client.setQueryData(['unrelated'], 'preserved')
  const view = renderHook(() => ({ create: useCreateCustomer(), update: useUpdateCustomer('customer-1'), delete: useDeleteCustomer() }), { wrapper })
  await act(async () => {
    if (operation === 'create') await view.result.current.create.mutateAsync({ name: updated.name, phone: updated.phone })
    else if (operation === 'update') await view.result.current.update.mutateAsync({ name: updated.name })
    else await view.result.current.delete.mutateAsync('customer-1')
  })
  for (const key of [customerKeys.list(''), quoteSummariesQueryKey, ['dashboard']]) expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  expect(client.getQueryData(['unrelated'])).toBe('preserved')
  if (operation === 'delete') {
    expect(client.getQueryData(customerKeys.detail('customer-1'))).toBeUndefined()
    expect(client.getQueryData(customerKeys.history('customer-1'))).toBeUndefined()
  } else expect(client.getQueryData(customerKeys.detail('customer-1'))).toEqual(updated)
  view.unmount(); client.clear()
})
test('failed deletion preserves data and propagates 404 instead of approving future UX policy', async () => {
  const handler = vi.fn(() => new HttpResponse(null, { status: 404 }))
  server.use(http.delete('*/clientes/customer-1', handler))
  const { client, wrapper } = setup()
  client.setQueryData(customerKeys.detail('customer-1'), customerFixture)
  const view = renderHook(useDeleteCustomer, { wrapper })
  await act(async () => { await expect(view.result.current.mutateAsync('customer-1')).rejects.toMatchObject({ status: 404 }) })
  expect(client.getQueryData(customerKeys.detail('customer-1'))).toEqual(customerFixture)
  expect(client.getQueryState(customerKeys.detail('customer-1'))?.isInvalidated).toBe(false)
  expect(handler).toHaveBeenCalledOnce()
  view.unmount(); client.clear()
})

test('exposes query failures without automatic retry and supports manual refetch', async () => {
  const handler = vi.fn(() => new HttpResponse(null, { status: 500 }))
  server.use(http.get('*/clientes', handler))
  const { client, wrapper } = setup()
  const view = renderHook(() => useCustomers('Ana'), { wrapper })
  await waitFor(() => expect(view.result.current.isError).toBe(true))
  expect(handler).toHaveBeenCalledOnce()
  server.use(http.get('*/clientes', () => HttpResponse.json([])))
  await act(async () => { await view.result.current.refetch() })
  await waitFor(() => expect(view.result.current.isSuccess).toBe(true))
  view.unmount(); client.clear()
})

test('cancels stale customer, quote-summary and dashboard reads before accepting updated detail', async () => {
  server.use(http.patch('*/clientes/customer-1', () => HttpResponse.json(customerFixture)))
  const { client, wrapper } = setup()
  const signals: AbortSignal[] = []
  const pending = [customerKeys.detail('customer-1'), quoteSummariesQueryKey, ['dashboard']].map((queryKey) => client.fetchQuery({
    queryKey, queryFn: ({ signal }) => {
      signals.push(signal)
      return new Promise<never>(() => {})
    },
  }).catch(() => {}))
  const view = renderHook(() => useUpdateCustomer('customer-1'), { wrapper })
  await act(async () => { await view.result.current.mutateAsync({ name: customerFixture.name }); await Promise.all(pending) })
  expect(signals).toHaveLength(3)
  expect(signals.every((signal) => signal.aborted)).toBe(true)
  expect(client.getQueryData(customerKeys.detail('customer-1'))).toEqual(customerFixture)
  view.unmount(); client.clear()
})
