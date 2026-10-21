import { http, HttpResponse } from 'msw'
import { server } from '@/shared/test/server'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { AppProviders } from './providers'
import { createAppQueryClient } from './query-client'

beforeEach(() => {
  server.use(http.get('*/auth/me', () => new HttpResponse(null, { status: 401 })))
})

function ClientProbe({ clients }: { clients: QueryClient[] }) {
  clients.push(useQueryClient())
  return <p>Provider disponível</p>
}

test('keeps the same client per mounted provider and isolates separate roots', () => {
  const clients: QueryClient[] = []
  const { rerender, unmount } = render(<AppProviders><ClientProbe clients={clients} /></AppProviders>)
  expect(screen.getByText('Provider disponível')).toBeVisible()
  rerender(<AppProviders><ClientProbe clients={clients} /></AppProviders>)
  expect(clients[0]).toBe(clients[1])
  unmount()
  render(<AppProviders><ClientProbe clients={clients} /></AppProviders>)
  expect(clients[2]).not.toBe(clients[0])
})

test('does not retry failures or persist cache between clients', async () => {
  const client = createAppQueryClient()
  const query = vi.fn().mockRejectedValue(new Error('Offline'))
  await expect(client.fetchQuery({ queryKey: ['foundation'], queryFn: query })).rejects.toThrow('Offline')
  expect(query).toHaveBeenCalledOnce()
  expect(client.getDefaultOptions().queries?.retry).toBe(false)
  expect(client.getDefaultOptions().mutations?.retry).toBe(false)
  client.setQueryData(['private'], 'memory-only')
  expect(createAppQueryClient().getQueryData(['private'])).toBeUndefined()
  client.clear()
})
