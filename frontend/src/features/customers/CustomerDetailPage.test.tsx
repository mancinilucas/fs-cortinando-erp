import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { http, HttpResponse } from 'msw'
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { AppRoutes } from '@/app/router'
import { server } from '@/shared/test/server'
import { customerFixture, customerQuotesFixture } from './fixtures.test-support'

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')
beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.open = false } },
  })
})
afterAll(() => {
  for (const [name, descriptor] of [['showModal', originalShowModal], ['close', originalClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name)
  }
})
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  server.use(
    http.get('*/auth/me', () => HttpResponse.json({ id: 'user-1', email: 'session@example.test' })),
    http.get('*/clientes/customer-1', () => HttpResponse.json(customerFixture)),
    http.get('*/clientes/customer-1/orcamentos', () => HttpResponse.json(customerQuotesFixture)),
    http.get('*/clientes', () => HttpResponse.json([])),
  )
})
function Probe() { return <output aria-label="Location">{useLocation().pathname}</output> }
function mount() { render(<AppProviders><MemoryRouter initialEntries={['/clientes/customer-1']}><AppRoutes /><Probe /></MemoryRouter></AppProviders>) }
async function openDelete() {
  fireEvent.click(await screen.findByRole('button', { name: 'Excluir cliente' }))
  return screen.getByRole('dialog')
}

test('renders registration, server quote values and contextual navigation', async () => {
  mount()
  expect(await screen.findByText(customerFixture.name)).toBeVisible()
  expect(screen.getByText(/Rua de teste, 10/)).toBeVisible()
  expect(screen.getByRole('link', { name: 'Novo orçamento' })).toHaveAttribute('href', '/clientes/customer-1/orcamentos/novo')
  expect(screen.getByRole('link', { name: 'Editar cliente' })).toHaveAttribute('href', '/clientes/customer-1/editar')
  const quote = await screen.findByRole('link', { name: /ORC-2026-001/ })
  expect(quote).toHaveAttribute('href', '/orcamentos/quote-1')
  expect(quote).toHaveTextContent('01/10/2026')
  expect(quote).toHaveTextContent(/1\.234,56/)
  expect(quote).toHaveTextContent('Expirado')
})
test('handles empty history and missing optional registration fields', async () => {
  server.use(http.get('*/clientes/customer-1/orcamentos', () => HttpResponse.json([])),
    http.get('*/clientes/customer-1', () => HttpResponse.json({ ...customerFixture, address: null })))
  mount()
  expect(await screen.findByText('Nenhum orçamento para este cliente.')).toBeVisible()
  expect(screen.getAllByText('Não informado')).toHaveLength(3)
})
test('retries history independently without hiding the customer', async () => {
  server.use(http.get('*/clientes/customer-1/orcamentos', () => new HttpResponse(null, { status: 500 })))
  mount(); await screen.findByRole('alert')
  expect(screen.getByText(customerFixture.name)).toBeVisible()
  server.use(http.get('*/clientes/customer-1/orcamentos', () => HttpResponse.json(customerQuotesFixture)))
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  expect(await screen.findByRole('link', { name: /ORC-2026-001/ })).toBeVisible()
})
test('blocks actions and history on customer 404', async () => {
  const history = vi.fn(() => HttpResponse.json([]))
  server.use(http.get('*/clientes/customer-1', () => new HttpResponse(null, { status: 404 })), http.get('*/clientes/customer-1/orcamentos', history))
  mount()
  expect(await screen.findByText('Cliente não encontrado ou excluído.')).toBeVisible()
  expect(screen.queryByRole('link', { name: 'Novo orçamento' })).not.toBeInTheDocument()
  expect(history).not.toHaveBeenCalled()
})
test('requires named confirmation and cancel sends no delete', async () => {
  const remove = vi.fn(() => new HttpResponse(null, { status: 204 }))
  server.use(http.delete('*/clientes/customer-1', remove))
  mount(); const dialog = await openDelete()
  expect(dialog).toHaveAccessibleDescription(`Deseja excluir ${customerFixture.name}? Os orçamentos vinculados serão preservados.`)
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(remove).not.toHaveBeenCalled()
})
test.each([204, 404])('returns to customer list on delete %s', async (status) => {
  const remove = vi.fn(() => new HttpResponse(null, { status }))
  server.use(http.delete('*/clientes/customer-1', remove))
  mount(); const dialog = await openDelete()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar exclusão' }))
  await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/clientes$/))
  expect(remove).toHaveBeenCalledOnce()
})
test('preserves the dialog on failure and allows retry', async () => {
  server.use(http.delete('*/clientes/customer-1', () => new HttpResponse(null, { status: 500 })))
  mount(); const dialog = await openDelete()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar exclusão' }))
  expect(await within(dialog).findByRole('alert')).toBeVisible()
  expect(screen.getByLabelText('Location')).toHaveTextContent('/clientes/customer-1')
  expect(within(dialog).getByRole('button', { name: 'Confirmar exclusão' })).toBeEnabled()
})
test('locks repeated deletion and dismissal while pending', async () => {
  let finish!: () => void
  const pending = new Promise<void>((resolve) => { finish = resolve })
  const remove = vi.fn(async () => { await pending; return new HttpResponse(null, { status: 204 }) })
  server.use(http.delete('*/clientes/customer-1', remove))
  mount(); const dialog = await openDelete()
  const confirm = within(dialog).getByRole('button', { name: 'Confirmar exclusão' })
  fireEvent.click(confirm); fireEvent.click(confirm)
  await waitFor(() => expect(remove).toHaveBeenCalledOnce())
  expect(within(dialog).getByRole('button', { name: 'Excluindo…' })).toBeDisabled()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar diálogo' }))
  expect(dialog).toBeVisible()
  finish()
  await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/clientes$/))
})
