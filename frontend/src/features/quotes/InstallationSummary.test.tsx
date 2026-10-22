import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { http, HttpResponse } from 'msw'
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { AppRoutes } from '@/app/router'
import { server } from '@/shared/test/server'
import { customerFixture } from '@/features/customers/fixtures.test-support'
import { quoteFixture } from './fixtures.test-support'
import type { QuoteDetail } from './types'

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

function save(dialog: HTMLElement) { fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar agendamento' })) }
const fieldLabel = 'Data e hora da instalação (obrigatórias)'

test.each(['DRAFT', 'SENT', 'COMPLETED', 'CANCELLED'] as const)('hides scheduling actions in %s', async (status) => {
  current.status = status; mount()
  await screen.findByRole('heading', { name: 'Instalação' })
  expect(screen.queryByRole('button', { name: 'Agendar instalação' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Remover instalação' })).not.toBeInTheDocument()
})
test.each(['CONFIRMED', 'IN_PRODUCTION'] as const)('schedules a past instant in %s and uses the returned late flag', async (status) => {
  current.status = status
  const handler = vi.fn(async ({ request }: { request: Request }) => {
    expect(await request.json()).toEqual({ scheduledInstallationAt: '2000-07-01T15:30:00.000Z' })
    current = { ...current, scheduledInstallationAt: '2000-07-01T15:30:00.000Z', lateInstallation: false }
    return HttpResponse.json(current)
  })
  server.use(http.put('*/orcamentos/quote-1/instalacao', handler))
  mount(); const dialog = await open('Agendar instalação')
  save(dialog)
  expect(await within(dialog).findByText('Informe a data e hora da instalação.')).toBeVisible()
  expect(handler).not.toHaveBeenCalled()
  fireEvent.change(within(dialog).getByLabelText(fieldLabel), { target: { value: '2000-07-01T12:30' } })
  save(dialog)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(handler).toHaveBeenCalledOnce()
  expect(await screen.findByRole('button', { name: 'Alterar instalação' })).toBeVisible()
  expect(screen.queryByText('Instalação em atraso')).not.toBeInTheDocument()
})
test('editing retains the existing instant precision', async () => {
  current.status = 'CONFIRMED'; current.scheduledInstallationAt = '2026-10-21T15:30:42.123Z'
  const handler = vi.fn(async ({ request }: { request: Request }) => {
    expect(await request.json()).toEqual({ scheduledInstallationAt: current.scheduledInstallationAt })
    return HttpResponse.json(current)
  })
  server.use(http.put('*/orcamentos/quote-1/instalacao', handler))
  mount(); const dialog = await open('Alterar instalação'); save(dialog)
  await waitFor(() => expect(handler).toHaveBeenCalledOnce())
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})
test('removal requires confirmation and refetches the detail after 204', async () => {
  current.status = 'IN_PRODUCTION'; current.scheduledInstallationAt = '2099-10-21T15:30:00Z'
  const handler = vi.fn(() => {
    current = { ...current, scheduledInstallationAt: null, lateInstallation: false }
    return new HttpResponse(null, { status: 204 })
  })
  server.use(http.delete('*/orcamentos/quote-1/instalacao', handler))
  mount(); let dialog = await open('Remover instalação')
  expect(handler).not.toHaveBeenCalled()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
  expect(handler).not.toHaveBeenCalled()
  dialog = await open('Remover instalação')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar remoção' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(handler).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: 'Agendar instalação' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Concluir serviço' })).toBeEnabled()
})
test('failed scheduling retains the entered date and supports retry', async () => {
  current.status = 'CONFIRMED'
  const handler = vi.fn(() => new HttpResponse(null, { status: 500 }))
  server.use(http.put('*/orcamentos/quote-1/instalacao', handler))
  mount(); const dialog = await open('Agendar instalação')
  const input = within(dialog).getByLabelText(fieldLabel)
  fireEvent.change(input, { target: { value: '2026-10-21T12:30' } }); save(dialog)
  await within(dialog).findByRole('alert')
  expect(input).toHaveValue('2026-10-21T12:30')
  expect(within(dialog).getByRole('button', { name: 'Salvar agendamento' })).toBeEnabled()
  save(dialog); await waitFor(() => expect(handler).toHaveBeenCalledTimes(2))
})
test('409 reloads status and prevents retry when scheduling is no longer allowed', async () => {
  current.status = 'CONFIRMED'
  server.use(http.put('*/orcamentos/quote-1/instalacao', () => {
    current = { ...current, status: 'CANCELLED' }
    return HttpResponse.json({ message: 'Conflict' }, { status: 409 })
  }))
  mount(); const dialog = await open('Agendar instalação')
  fireEvent.change(within(dialog).getByLabelText(fieldLabel), { target: { value: '2026-10-21T12:30' } }); save(dialog)
  await within(dialog).findByText(/Situação conhecida: Cancelado/)
  expect(within(dialog).getByRole('button', { name: 'Salvar agendamento' })).toBeDisabled()
})
test('pending scheduling prevents duplicate submission and closing without optimistic changes', async () => {
  current.status = 'CONFIRMED'
  let release!: () => void
  const held = new Promise<void>((resolve) => { release = resolve })
  const handler = vi.fn(async () => {
    await held
    current = { ...current, scheduledInstallationAt: '2099-10-21T15:30:00Z', lateInstallation: true }
    return HttpResponse.json(current)
  })
  server.use(http.put('*/orcamentos/quote-1/instalacao', handler))
  mount(); const dialog = await open('Agendar instalação')
  fireEvent.change(within(dialog).getByLabelText(fieldLabel), { target: { value: '2099-10-21T12:30' } })
  fireEvent.submit(dialog.querySelector('form')!); fireEvent.submit(dialog.querySelector('form')!)
  await waitFor(() => expect(handler).toHaveBeenCalledOnce())
  expect(within(dialog).getByLabelText(fieldLabel)).toBeDisabled()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
  expect(dialog).toBeInTheDocument()
  expect(screen.queryByText('Instalação em atraso')).not.toBeInTheDocument()
  release()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByText('Instalação em atraso')).toBeVisible()
})
test('failed removal preserves the schedule and allows another explicit attempt', async () => {
  current.status = 'CONFIRMED'; current.scheduledInstallationAt = '2099-10-21T15:30:00Z'
  const handler = vi.fn(() => HttpResponse.error())
  server.use(http.delete('*/orcamentos/quote-1/instalacao', handler))
  mount(); const dialog = await open('Remover instalação')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar remoção' }))
  await within(dialog).findByRole('alert')
  expect(screen.getByRole('button', { name: 'Alterar instalação' })).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Confirmar remoção' })).toBeEnabled()
  expect(handler).toHaveBeenCalledOnce()
})
