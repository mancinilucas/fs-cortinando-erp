import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { expect, test, vi } from 'vitest'
import { createAppQueryClient } from '@/app/query-client'
import { server } from '@/shared/test/server'
import { dashboardFixture } from './fixtures.test-support'
import { dashboardQueryKey, useDashboard } from './use-dashboard'

function setup() {
  const client = createAppQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, wrapper }
}

test('deduplicates concurrent consumers under the dashboard key and exposes loading/data', async () => {
  const handler = vi.fn(() => HttpResponse.json(dashboardFixture))
  server.use(http.get('*/dashboard', handler))
  const { client, wrapper } = setup()
  const view = renderHook(() => [useDashboard(), useDashboard()], { wrapper })
  expect(view.result.current[0].isPending).toBe(true)
  await waitFor(() => expect(view.result.current.every((query) => query.isSuccess)).toBe(true))
  expect(view.result.current[0].data).toEqual(dashboardFixture)
  expect(client.getQueryData(dashboardQueryKey)).toEqual(dashboardFixture)
  expect(handler).toHaveBeenCalledOnce()
  view.unmount(); client.clear()
})

test('does not retry automatically and supports explicit refetch after failure', async () => {
  const handler = vi.fn(() => new HttpResponse(null, { status: 500 }))
  server.use(http.get('*/dashboard', handler))
  const { client, wrapper } = setup()
  const view = renderHook(useDashboard, { wrapper })
  await waitFor(() => expect(view.result.current.isError).toBe(true))
  expect(handler).toHaveBeenCalledOnce()
  expect(view.result.current.data).toBeUndefined()
  server.use(http.get('*/dashboard', () => HttpResponse.json(dashboardFixture)))
  await act(async () => { await view.result.current.refetch() })
  await waitFor(() => expect(view.result.current.data).toEqual(dashboardFixture))
  view.unmount(); client.clear()
})

test('forwards query cancellation to the request on unmount', async () => {
  let signal: AbortSignal | undefined
  server.use(http.get('*/dashboard', ({ request }) => {
    signal = request.signal
    return new Promise<Response>(() => {})
  }))
  const { client, wrapper } = setup()
  const view = renderHook(useDashboard, { wrapper })
  await waitFor(() => expect(signal).toBeDefined())
  view.unmount()
  await waitFor(() => expect(signal?.aborted).toBe(true))
  expect(client.getQueryData(dashboardQueryKey)).toBeUndefined()
  client.clear()
})
