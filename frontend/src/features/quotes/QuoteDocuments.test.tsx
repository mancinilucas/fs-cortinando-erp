import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { beforeEach, expect, test, vi } from 'vitest'
import { createAppQueryClient } from '@/app/query-client'
import { server } from '@/shared/test/server'
import { QuoteDocuments } from './QuoteDocuments'
import { quoteFixture } from './fixtures.test-support'
import { quoteKeys } from './query-keys'
import { ToastProvider } from '@/shared/components/Toast'
import { getQuote } from './api'
import type { QuoteDetail } from './types'

let current: QuoteDetail
let deliveries: { href: string; target: string; rel: string; download: string }[]
beforeEach(() => {
  current = structuredClone(quoteFixture)
  deliveries = []
  vi.stubGlobal('URL', Object.assign(URL, {
    createObjectURL: vi.fn(() => `blob:test-${deliveries.length}`), revokeObjectURL: vi.fn(),
  }))
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    deliveries.push({ href: this.href, target: this.target, rel: this.rel, download: this.download })
  })
})
function mount() {
  const client = createAppQueryClient()
  const view = render(<ToastProvider><QueryClientProvider client={client}><MemoryRouter><QuoteDocuments quote={current} /></MemoryRouter></QueryClientProvider></ToastProvider>)
  return { ...view, client }
}
function pdf() { return new HttpResponse('%PDF-1.7', { headers: { 'Content-Type': 'application/pdf' } }) }

test.each(['DRAFT', 'SENT', 'CONFIRMED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED'] as const)('offers only available actions without prefetch in %s', (status) => {
  current.status = status; mount()
  expect(screen.queryByRole('button', { name: 'Prévia do PDF' }) !== null).toBe(status === 'DRAFT')
  expect(screen.queryByRole('button', { name: 'Gerar PDF' }) !== null).toBe(status !== 'DRAFT' && status !== 'CANCELLED')
  expect(screen.queryByRole('button', { name: 'Ordem de produção' }) !== null).toBe(['CONFIRMED', 'IN_PRODUCTION', 'COMPLETED'].includes(status))
  expect(URL.createObjectURL).not.toHaveBeenCalled()
})
test('opens only after PDF success and revokes on replacement and unmount without caching bytes', async () => {
  const handler = vi.fn(pdf)
  server.use(http.get('*/orcamentos/quote-1/pdf', handler))
  const view = mount()
  expect(handler).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Prévia do PDF' }))
  await waitFor(() => expect(deliveries).toHaveLength(1))
  expect(deliveries[0]).toMatchObject({ href: 'blob:test-0', target: '_blank', rel: 'noopener noreferrer', download: '' })
  expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Baixar prévia do PDF' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Baixar prévia do PDF' }))
  await waitFor(() => expect(deliveries).toHaveLength(2))
  expect(deliveries[1].download).toMatch(/^orcamento-.*\.pdf$/)
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-0')
  expect(handler).toHaveBeenCalledTimes(2)
  expect(view.client.getQueryCache().getAll()).toHaveLength(0)
  expect(view.client.getMutationCache().getAll()).toHaveLength(0)
  view.unmount()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1')
})
test.each(['commercial', 'production'] as const)('refreshes history after %s generation without changing quote status', async (kind) => {
  current.status = 'CONFIRMED'
  server.use(http.get(`*/orcamentos/quote-1/${kind === 'commercial' ? 'pdf' : 'ordem-producao'}`, pdf))
  const { client } = mount()
  client.setQueryData(quoteKeys.detail(current.id), current)
  client.setQueryData(quoteKeys.history(current.id), [])
  fireEvent.click(screen.getByRole('button', { name: kind === 'commercial' ? 'Gerar PDF' : 'Baixar ordem de produção' }))
  await waitFor(() => expect(client.getQueryState(quoteKeys.history(current.id))?.isInvalidated).toBe(true))
  expect(client.getQueryData(quoteKeys.detail(current.id))).toEqual(current)
  expect(client.getQueryState(quoteKeys.detail(current.id))?.isInvalidated).toBe(true)
})
test.each([
  ['Business data is not configured', 409, 'Os dados do negócio ainda não foram configurados.'],
  ['Document data is incomplete', 409, 'Faltam dados para gerar o documento.'],
  ['Could not generate the document', 500, 'Não foi possível gerar o documento. Tente novamente.'],
  ['private trace', 500, 'Não foi possível concluir a operação. Tente novamente.'],
] as const)('handles %s in the application without opening or automatic retry', async (message, status, translated) => {
  const handler = vi.fn(() => HttpResponse.json({ message }, { status }))
  server.use(http.get('*/orcamentos/quote-1/pdf', handler))
  mount(); fireEvent.click(screen.getByRole('button', { name: 'Prévia do PDF' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(translated)
  expect(deliveries).toHaveLength(0)
  expect(URL.createObjectURL).not.toHaveBeenCalled()
  expect(handler).toHaveBeenCalledOnce()
  if (message === 'Business data is not configured') expect(screen.getByRole('link', { name: 'Configurar dados do negócio' })).toHaveAttribute('href', '/configuracoes/dados-do-negocio')
  if (message === 'Document data is incomplete') expect(screen.getByText(/Confira os dados em Cliente, Cortinas/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Prévia do PDF' }))
  await waitFor(() => expect(handler).toHaveBeenCalledTimes(2))
})
test('production errors never offer business configuration', async () => {
  current.status = 'CONFIRMED'
  server.use(http.get('*/orcamentos/quote-1/ordem-producao', () => HttpResponse.json({ message: 'Business data is not configured' }, { status: 409 })))
  mount(); fireEvent.click(screen.getByRole('button', { name: 'Ordem de produção' }))
  await screen.findByRole('alert')
  expect(screen.queryByRole('link', { name: 'Configurar dados do negócio' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Gerar PDF' })).toBeEnabled()
})
test('status conflicts refetch the quote and update available actions', async () => {
  current.status = 'CONFIRMED'
  server.use(http.get('*/orcamentos/quote-1', () => HttpResponse.json(current)), http.get('*/orcamentos/quote-1/pdf', () => {
    current = { ...current, status: 'CANCELLED' }
    return HttpResponse.json({ message: 'Document is not available in the current status' }, { status: 409 })
  }))
  function LiveDocuments() {
    const query = useQuery({ queryKey: quoteKeys.detail(current.id), queryFn: ({ signal }) => getQuote(current.id, signal) })
    return query.data ? <QuoteDocuments quote={query.data} /> : null
  }
  render(<ToastProvider><QueryClientProvider client={createAppQueryClient()}><MemoryRouter><LiveDocuments /></MemoryRouter></QueryClientProvider></ToastProvider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Gerar PDF' }))
  await screen.findByText('Nenhum documento disponível nesta situação.')
  expect(screen.queryByRole('button', { name: 'Gerar PDF' })).not.toBeInTheDocument()
  expect(await screen.findByRole('alert')).toHaveTextContent('O documento não está disponível na situação atual.')
})
test('pending generation locks all actions and unmount aborts without creating a URL', async () => {
  current.status = 'CONFIRMED'
  let release!: () => void
  const held = new Promise<void>((resolve) => { release = resolve })
  const handler = vi.fn(async () => { await held; return pdf() })
  server.use(http.get('*/orcamentos/quote-1/pdf', handler))
  const view = mount()
  const button = screen.getByRole('button', { name: 'Gerar PDF' })
  fireEvent.click(button); fireEvent.click(button)
  await waitFor(() => expect(handler).toHaveBeenCalledOnce())
  for (const action of screen.getAllByRole('button')) expect(action).toBeDisabled()
  expect(deliveries).toHaveLength(0)
  view.unmount(); release()
  await waitFor(() => expect(URL.createObjectURL).not.toHaveBeenCalled())
})
test('preview does not invalidate history and malformed success never opens a document', async () => {
  server.use(http.get('*/orcamentos/quote-1/pdf', pdf))
  const { client } = mount()
  client.setQueryData(quoteKeys.history(current.id), [])
  fireEvent.click(screen.getByRole('button', { name: 'Prévia do PDF' }))
  await waitFor(() => expect(deliveries).toHaveLength(1))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Prévia do PDF' })).toBeEnabled())
  expect(client.getQueryState(quoteKeys.history(current.id))?.isInvalidated).toBe(false)
  server.use(http.get('*/orcamentos/quote-1/pdf', () => HttpResponse.json({ private: 'diagnostic' })))
  fireEvent.click(screen.getByRole('button', { name: 'Prévia do PDF' }))
  await screen.findByRole('alert')
  expect(deliveries).toHaveLength(1)
  expect(URL.createObjectURL).toHaveBeenCalledOnce()
  expect(screen.queryByText('diagnostic')).not.toBeInTheDocument()
})
test('network failure remains in the application without automatic retry', async () => {
  const handler = vi.fn(() => HttpResponse.error())
  server.use(http.get('*/orcamentos/quote-1/pdf', handler))
  mount(); fireEvent.click(screen.getByRole('button', { name: 'Baixar prévia do PDF' }))
  await screen.findByRole('alert')
  expect(handler).toHaveBeenCalledOnce()
  expect(deliveries).toHaveLength(0)
  expect(screen.getByRole('button', { name: 'Baixar prévia do PDF' })).toBeEnabled()
})
