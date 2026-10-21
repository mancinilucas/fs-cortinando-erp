import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, test, vi } from 'vitest'
import { createAppQueryClient } from '@/app/query-client'
import { customerKeys } from '@/features/customers/query-keys'
import { dashboardQueryKey } from '@/features/dashboard/use-dashboard'
import { server } from '@/shared/test/server'
import { quoteFixture } from './fixtures.test-support'
import { quoteKeys } from './query-keys'
import { useCreateQuote, useQuote, useUpdateQuote } from './hooks'

function setup() {
  const client = createAppQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, wrapper }
}
test('deduplicates the same quote query and disables reads without an id', async () => {
  const handler = vi.fn(() => HttpResponse.json(quoteFixture))
  server.use(http.get('*/orcamentos/quote-1', handler))
  const { client, wrapper } = setup()
  const view = renderHook(() => [useQuote('quote-1'), useQuote('quote-1'), useQuote(undefined)], { wrapper })
  await waitFor(() => expect(view.result.current[0].isSuccess).toBe(true))
  expect(handler).toHaveBeenCalledOnce()
  expect(view.result.current[2].fetchStatus).toBe('idle')
  view.unmount(); client.clear()
})
test.each(['create', 'update'] as const)('%s stores the returned detail and invalidates lists, history, customer history and dashboard', async (operation) => {
  const saved = { ...quoteFixture, notes: 'Server confirmed' }
  server.use(http.post('*/clientes/customer-1/orcamentos', () => HttpResponse.json(saved, { status: 201 })), http.patch('*/orcamentos/quote-1', () => HttpResponse.json(saved)))
  const { client, wrapper } = setup()
  const dependents = [quoteKeys.list({ search: 'Ana' }), quoteKeys.history('quote-1'), customerKeys.history('customer-1'), dashboardQueryKey]
  for (const key of dependents) client.setQueryData(key, [])
  client.setQueryData(quoteKeys.detail('quote-1'), quoteFixture)
  client.setQueryData(customerKeys.history('other-customer'), 'preserved')
  const view = renderHook(() => ({ create: useCreateQuote('customer-1'), update: useUpdateQuote('quote-1') }), { wrapper })
  await act(async () => {
    if (operation === 'create') await view.result.current.create.mutateAsync({ notes: 'Client' })
    else await view.result.current.update.mutateAsync({ notes: 'Client' })
  })
  expect(client.getQueryData(quoteKeys.detail('quote-1'))).toEqual(saved)
  expect(client.getQueryState(quoteKeys.detail('quote-1'))?.isInvalidated).toBe(true)
  for (const key of dependents) expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  expect(client.getQueryData(customerKeys.history('other-customer'))).toBe('preserved')
  view.unmount(); client.clear()
})
test('does not invalidate or replace confirmed data on an unsuccessful update', async () => {
  server.use(http.patch('*/orcamentos/quote-1', () => new HttpResponse(null, { status: 422 })))
  const { client, wrapper } = setup()
  client.setQueryData(quoteKeys.detail('quote-1'), quoteFixture)
  client.setQueryData(quoteKeys.list(), [])
  const view = renderHook(() => useUpdateQuote('quote-1'), { wrapper })
  await act(async () => { await expect(view.result.current.mutateAsync({ notes: 'unsaved' })).rejects.toMatchObject({ status: 422 }) })
  expect(client.getQueryData(quoteKeys.detail('quote-1'))).toEqual(quoteFixture)
  expect(client.getQueryState(quoteKeys.list())?.isInvalidated).toBe(false)
  view.unmount(); client.clear()
})
test('cancels stale reads before accepting the mutation detail', async () => {
  const saved = { ...quoteFixture, notes: 'confirmed' }
  server.use(http.patch('*/orcamentos/quote-1', () => HttpResponse.json(saved)))
  const { client, wrapper } = setup()
  const signals: AbortSignal[] = []
  const keys = [quoteKeys.detail('quote-1'), quoteKeys.lists(), quoteKeys.history('quote-1'), customerKeys.history('customer-1'), dashboardQueryKey]
  const pending = keys.map((queryKey) => client.fetchQuery({ queryKey, queryFn: ({ signal }) => {
    signals.push(signal)
    return new Promise<never>(() => {})
  } }).catch(() => {}))
  const view = renderHook(() => useUpdateQuote('quote-1'), { wrapper })
  await act(async () => { await view.result.current.mutateAsync({ notes: 'client' }); await Promise.all(pending) })
  expect(signals).toHaveLength(5)
  expect(signals.every((signal) => signal.aborted)).toBe(true)
  expect(client.getQueryData(quoteKeys.detail('quote-1'))).toEqual(saved)
  view.unmount(); client.clear()
})
