import { QueryClientProvider } from '@tanstack/react-query'
import { createAppQueryClient } from '@/app/query-client'
import { QuoteActions } from './QuoteActions'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'
import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { AppRoutes } from '@/app/router'
import { server } from '@/shared/test/server'
import { customerFixture } from '@/features/customers/fixtures.test-support'
import { quoteFixture } from './fixtures.test-support'
import type { QuoteDetail } from './types'

afterEach(() => vi.useRealTimers())
let current: QuoteDetail
const show = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')
beforeAll(() => Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true } },
  close: { configurable: true, value(this: HTMLDialogElement) { this.open = false } },
}))
afterAll(() => {
  for (const [key, descriptor] of [['showModal', show], ['close', close]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key)
  }
})
beforeEach(() => {
  current = structuredClone(quoteFixture)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  server.use(http.get('*/auth/me', () => HttpResponse.json({ id: 'u', email: 'session@example.test' })),
    http.get('*/orcamentos/quote-1', () => HttpResponse.json(current)),
    http.get('*/orcamentos/quote-1/historico', () => HttpResponse.json([])),
    http.get('*/clientes/customer-1', () => HttpResponse.json(customerFixture)), http.get('*/orcamentos', () => HttpResponse.json([])))
})
function mount() {
  const router = createMemoryRouter([{ path: '*', element: <AppRoutes /> }], { initialEntries: ['/orcamentos/quote-1'] })
  render(<AppProviders><RouterProvider router={router} /></AppProviders>)
  return router
}
async function open(name: string) { fireEvent.click(await screen.findByRole('button', { name })); return screen.getByRole('dialog') }
function confirm(dialog: HTMLElement) { fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar ação' })) }

test.each([
  ['DRAFT', 'Marcar como enviado', 'enviar', 'SENT'], ['SENT', 'Confirmar', 'confirmar', 'CONFIRMED'],
  ['CONFIRMED', 'Reabrir orçamento', 'reabrir', 'SENT'], ['CONFIRMED', 'Iniciar produção', 'iniciar-producao', 'IN_PRODUCTION'],
  ['IN_PRODUCTION', 'Concluir serviço', 'concluir', 'COMPLETED'],
] as const)('%s %s requires confirmation and replaces detail from its dedicated endpoint', async (status, label, endpoint, next) => {
  current.status = status
  const handler = vi.fn(async ({ request }: { request: Request }) => {
    expect(await request.text()).toBe(endpoint === 'enviar' ? '{}' : '')
    current = { ...current, status: next }
    return HttpResponse.json(current)
  })
  server.use(http.post(`*/orcamentos/quote-1/${endpoint}`, handler))
  mount(); const dialog = await open(label)
  expect(handler).not.toHaveBeenCalled()
  expect(dialog).toHaveTextContent(current.quoteNumber)
  confirm(dialog)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(handler).toHaveBeenCalledOnce()
  const summary = screen.getByRole('region', { name: 'Resumo do orçamento' })
  const labels = { SENT: 'Enviado', CONFIRMED: 'Confirmado', IN_PRODUCTION: 'Em produção', COMPLETED: 'Concluído' }
  expect(summary).toHaveTextContent(labels[next])
})
test('closing confirmation sends nothing', async () => {
  const handler = vi.fn(() => HttpResponse.json(current))
  server.use(http.post('*/orcamentos/quote-1/enviar', handler))
  mount(); const dialog = await open('Marcar como enviado')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Voltar' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(handler).not.toHaveBeenCalled()
})
test('renewal requires a future validity and sends the Sao Paulo instant in UTC', async () => {
  current.status = 'SENT'; current.expired = true
  const handler = vi.fn(async ({ request }: { request: Request }) => {
    expect(await request.json()).toEqual({ validUntil: '2099-10-21T15:30:00.000Z' })
    current = { ...current, expired: false, validUntil: '2099-10-21T15:30:00.000Z' }
    return HttpResponse.json(current)
  })
  server.use(http.post('*/orcamentos/quote-1/renovar', handler))
  mount(); const dialog = await open('Renovar orçamento'); confirm(dialog)
  expect(await within(dialog).findByText('Informe a nova validade.')).toBeVisible()
  const input = within(dialog).getByLabelText('Nova validade (obrigatória)')
  fireEvent.change(input, { target: { value: '2000-01-01T12:00' } }); confirm(dialog)
  expect(await within(dialog).findByText('Informe uma validade futura.')).toBeVisible()
  expect(handler).not.toHaveBeenCalled()
  fireEvent.change(input, { target: { value: '2099-10-21T12:30' } }); confirm(dialog)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(handler).toHaveBeenCalledOnce()
})
test('cancel accepts an optional trimmed reason and enforces its length', async () => {
  const handler = vi.fn(async ({ request }: { request: Request }) => {
    expect(await request.json()).toEqual({ reason: 'Pedido da cliente' })
    current = { ...current, status: 'CANCELLED' }; return HttpResponse.json(current)
  })
  server.use(http.post('*/orcamentos/quote-1/cancelar', handler))
  mount(); const dialog = await open('Cancelar orçamento')
  const input = within(dialog).getByLabelText('Motivo do cancelamento (opcional)')
  fireEvent.change(input, { target: { value: 'x'.repeat(501) } }); confirm(dialog)
  expect(await within(dialog).findByText('Use no máximo 500 caracteres.')).toBeVisible()
  expect(handler).not.toHaveBeenCalled()
  fireEvent.change(input, { target: { value: '  Pedido da cliente  ' } }); confirm(dialog)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByRole('region', { name: 'Resumo do orçamento' })).toHaveTextContent('Cancelado')
})
test('explains re-opening and production consequences', async () => {
  current.status = 'CONFIRMED'; mount()
  let dialog = await open('Reabrir orçamento')
  expect(dialog).toHaveTextContent(/remove a confirmação e o agendamento/)
  expect(dialog).toHaveTextContent(/pode voltar expirado/)
  fireEvent.click(within(dialog).getByRole('button', { name: 'Voltar' }))
  dialog = await open('Iniciar produção')
  expect(dialog).toHaveTextContent(/irreversível/)
  expect(dialog).toHaveTextContent(/não poderá ser cancelado/)
})
test('expired comes from the server and prevents confirmation', async () => {
  current.status = 'SENT'; current.expired = true; current.validUntil = '2099-10-21T15:30:00Z'
  mount(); await screen.findByRole('button', { name: 'Renovar orçamento' })
  expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
})
test('blocks completion with a future installation and explains why', async () => {
  current.status = 'IN_PRODUCTION'; current.scheduledInstallationAt = '2099-10-21T15:30:00Z'
  mount(); expect(await screen.findByRole('button', { name: 'Concluir serviço' })).toBeDisabled()
  expect(screen.getByText(/A conclusão estará disponível após/)).toBeVisible()
})
test('422 gates group safe translated violations by curtain without exposing raw messages', async () => {
  server.use(http.post('*/orcamentos/quote-1/enviar', () => HttpResponse.json({ message: 'Quote does not satisfy the sending requirements', errors: [
    { code: 'CURTAIN_HEIGHT_INVALID', message: 'Curtain 2 height must be greater than zero' },
    { code: 'CURTAIN_MATERIAL_REQUIRED', message: 'Curtain 2 must have a material' },
    { code: 'INSTALLATION_ADDRESS_INCOMPLETE', message: 'private diagnostic' },
    { code: 'FUTURE_GATE', message: 'sensitive trace' },
  ] }, { status: 422 })))
  mount(); const dialog = await open('Marcar como enviado'); confirm(dialog)
  const group = await within(dialog).findByRole('region', { name: 'Cortina 2' })
  expect(group).toHaveTextContent('Confira a altura da cortina.')
  expect(group).toHaveTextContent('Informe o material da cortina.')
  expect(dialog).not.toHaveTextContent('private diagnostic')
  expect(dialog).not.toHaveTextContent('sensitive trace')
  expect(screen.getByRole('region', { name: 'Resumo do orçamento' })).toHaveTextContent('Rascunho')
})
test('409 refetches current status and disables a now-invalid action', async () => {
  server.use(http.post('*/orcamentos/quote-1/enviar', () => {
    current = { ...current, status: 'CANCELLED' }
    return HttpResponse.json({ message: 'Quote transition is not allowed in the current status' }, { status: 409 })
  }))
  mount(); const dialog = await open('Marcar como enviado'); confirm(dialog)
  expect(await within(dialog).findByText('Situação conhecida: Cancelado. Confira os dados antes de tentar novamente.')).toBeVisible()
  expect(within(dialog).getByRole('button', { name: 'Confirmar ação' })).toBeDisabled()
})
test('locks duplicate submissions and prevents closing while pending without optimistic status changes', async () => {
  let finish!: () => void
  const pending = new Promise<void>((resolve) => { finish = resolve })
  const handler = vi.fn(async () => { await pending; current = { ...current, status: 'SENT' }; return HttpResponse.json(current) })
  server.use(http.post('*/orcamentos/quote-1/enviar', handler))
  mount(); const dialog = await open('Marcar como enviado')
  const button = within(dialog).getByRole('button', { name: 'Confirmar ação' })
  fireEvent.click(button); fireEvent.click(button)
  await waitFor(() => expect(handler).toHaveBeenCalledOnce())
  expect(within(dialog).getByRole('button', { name: 'Processando…' })).toBeDisabled()
  expect(screen.getByRole('region', { name: 'Resumo do orçamento' })).toHaveTextContent('Rascunho')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar diálogo' }))
  expect(dialog).toBeVisible()
  finish(); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})
test('delete requires confirmation and returns to the quote list after 204', async () => {
  const handler = vi.fn(() => new HttpResponse(null, { status: 204 }))
  server.use(http.delete('*/orcamentos/quote-1', handler))
  const router = mount(); const dialog = await open('Excluir rascunho')
  expect(dialog).toHaveTextContent(/número não será reutilizado/)
  expect(handler).not.toHaveBeenCalled(); confirm(dialog)
  await waitFor(() => expect(router.state.location.pathname).toBe('/orcamentos'))
  expect(handler).toHaveBeenCalledOnce()
})
test.each([500, 'network'] as const)('preserves dialog on %s failure and supports retry', async (status) => {
  server.use(http.post('*/orcamentos/quote-1/enviar', () => status === 'network' ? HttpResponse.error() : HttpResponse.json({ message: 'private diagnostic' }, { status })))
  mount(); const dialog = await open('Marcar como enviado'); confirm(dialog)
  expect(await within(dialog).findByRole('alert')).not.toHaveTextContent('private diagnostic')
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Confirmar ação' })).toBeEnabled())
  server.use(http.post('*/orcamentos/quote-1/enviar', () => HttpResponse.json({ ...current, status: 'SENT' })))
  confirm(dialog); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})
test('a lifecycle 401 reaches the existing login boundary', async () => {
  server.use(http.post('*/orcamentos/quote-1/enviar', () => new HttpResponse(null, { status: 401 })))
  mount(); const dialog = await open('Marcar como enviado'); confirm(dialog)
  expect(await screen.findByLabelText('Senha')).toBeVisible()
})


test('updates active history after an action succeeds', async () => {
  let sent = false
  server.use(http.post('*/orcamentos/quote-1/enviar', () => {
    sent = true; current = { ...current, status: 'SENT' }; return HttpResponse.json(current)
  }), http.get('*/orcamentos/quote-1/historico', () => HttpResponse.json(sent ? [{ id: 'event', eventType: 'QUOTE_SENT', occurredAt: quoteFixture.createdAt, details: { validUntil: '2099-10-21T15:30:00Z', firstSend: true } }] : [])))
  mount(); const dialog = await open('Marcar como enviado'); confirm(dialog)
  expect(await screen.findByText('Orçamento enviado')).toBeVisible()
})
test('completion becomes available when the scheduled instant arrives without polling', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-21T12:00:00Z'))
  const client = createAppQueryClient()
  render(<QueryClientProvider client={client}><MemoryRouter><QuoteActions quote={{ ...quoteFixture, status: 'IN_PRODUCTION', scheduledInstallationAt: '2026-10-21T12:00:01Z' }} /></MemoryRouter></QueryClientProvider>)
  expect(screen.getByRole('button', { name: 'Concluir serviço' })).toBeDisabled()
  await act(async () => { await vi.advanceTimersByTimeAsync(1001) })
  expect(screen.getByRole('button', { name: 'Concluir serviço' })).toBeEnabled()
  client.clear()
})

test('send accepts an explicit validity instead of applying a local default', async () => {
  const handler = vi.fn(async ({ request }: { request: Request }) => {
    expect(await request.json()).toEqual({ validUntil: '2099-10-21T15:30:00.000Z' })
    return HttpResponse.json({ ...current, status: 'SENT' })
  })
  server.use(http.post('*/orcamentos/quote-1/enviar', handler))
  mount(); const dialog = await open('Marcar como enviado')
  fireEvent.change(within(dialog).getByLabelText('Validade (opcional)'), { target: { value: '2099-10-21T12:30' } })
  confirm(dialog)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(handler).toHaveBeenCalledOnce()
})
test('cancel can be confirmed without a reason', async () => {
  const handler = vi.fn(async ({ request }: { request: Request }) => {
    expect(await request.json()).toEqual({})
    return HttpResponse.json({ ...current, status: 'CANCELLED' })
  })
  server.use(http.post('*/orcamentos/quote-1/cancelar', handler))
  mount(); const dialog = await open('Cancelar orçamento'); confirm(dialog)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(handler).toHaveBeenCalledOnce()
})
test('completion conflict explains the installation restriction and prevents repeating the now-invalid action', async () => {
  current.status = 'IN_PRODUCTION'
  server.use(http.post('*/orcamentos/quote-1/concluir', () => {
    current = { ...current, scheduledInstallationAt: '2099-10-21T15:30:00Z' }
    return HttpResponse.json({ message: 'Quote cannot be completed before the scheduled installation' }, { status: 409 })
  }))
  mount(); const dialog = await open('Concluir serviço'); confirm(dialog)
  expect(await within(dialog).findByText('A conclusão só é permitida após a instalação agendada.')).toBeVisible()
  expect(within(dialog).getByRole('button', { name: 'Confirmar ação' })).toBeDisabled()
})


test('does not claim a successful reload when the conflict refetch fails', async () => {
  let conflict = false
  server.use(http.get('*/orcamentos/quote-1', () => conflict ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(current)),
    http.post('*/orcamentos/quote-1/enviar', () => { conflict = true; return new HttpResponse(null, { status: 409 }) }))
  mount(); const dialog = await open('Marcar como enviado'); confirm(dialog)
  expect(await within(dialog).findByText('Situação conhecida: Rascunho. Confira os dados antes de tentar novamente.')).toBeVisible()
  expect(dialog).not.toHaveTextContent('Dados recarregados')
})
