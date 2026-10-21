import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { http, HttpResponse } from 'msw'
import { beforeEach, expect, test, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { AppRoutes } from '@/app/router'
import { customerFixture } from '@/features/customers/fixtures.test-support'
import { server } from '@/shared/test/server'
import { quoteFixture } from './fixtures.test-support'

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  server.use(http.get('*/auth/me', () => HttpResponse.json({ id: 'user-1', email: 'session@example.test' })),
    http.get('*/orcamentos/quote-1', () => HttpResponse.json(quoteFixture)),
    http.get('*/clientes/customer-1', () => HttpResponse.json(customerFixture)),
    http.get('*/orcamentos/quote-1/historico', () => HttpResponse.json([])))
})
function mount() {
  const router = createMemoryRouter([{ path: '*', element: <AppRoutes /> }], { initialEntries: ['/orcamentos/quote-1'] })
  render(<AppProviders><RouterProvider router={router} /></AppProviders>)
  return router
}
const ready = () => screen.findByRole('region', { name: 'Resumo do orçamento' })

test('shows server values, current customer, installation snapshot, all dates and financial totals read-only', async () => {
  server.use(http.get('*/orcamentos/quote-1', () => HttpResponse.json({ ...quoteFixture,
    notes: 'Observação interna', installationAddress: { ...quoteFixture.installationAddress, street: 'Rua do orçamento' },
    generalAddOns: [{ id: 'add-on', name: 'Frete', quantity: 2, unit: 'un', unitPriceCents: 29, totalCents: 999 }],
    discount: { type: 'PERCENTAGE', percentage: 12.34, fixedAmountCents: null }, commercialAdjustmentCents: -1,
  })))
  mount(); await ready()
  expect(await screen.findByText(customerFixture.name)).toBeVisible()
  expect(screen.getByText(customerFixture.phone)).toBeVisible()
  expect(screen.getByText('Observação interna')).toBeVisible()
  const installation = screen.getByRole('region', { name: 'Instalação' })
  expect(within(installation).getByText('Rua do orçamento')).toBeVisible()
  expect(screen.queryByText(customerFixture.address!.street)).not.toBeInTheDocument()
  const curtains = screen.getByRole('region', { name: 'Cortinas' })
  expect(within(curtains).getByText('2,123')).toBeVisible()
  expect(within(curtains).getByText('7,321')).toBeVisible()
  expect(within(curtains).getByText('8,765')).toBeVisible()
  expect(within(curtains).getByText('1,123456')).toBeVisible()
  const additions = screen.getByRole('region', { name: 'Adicionais gerais' })
  expect(within(additions).getByText('Frete')).toBeVisible()
  expect(within(additions).getByText(/9,99/)).toBeVisible()
  expect(screen.getByText('12,34%')).toBeVisible()
  expect(screen.getByRole('region', { name: 'Totais salvos' })).toHaveTextContent(/9,87/)
  expect(screen.getByRole('region', { name: 'Datas do orçamento' })).toHaveTextContent('01/10/2026 às 09:00')
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Abrir cliente' })).toHaveAttribute('href', '/clientes/customer-1')
})
test('preserves curtain order and the actual server sequences', async () => {
  const second = { ...quoteFixture.curtains[0], id: 'other', sequence: 2 }
  server.use(http.get('*/orcamentos/quote-1', () => HttpResponse.json({ ...quoteFixture, curtains: [{ ...quoteFixture.curtains[0], sequence: 9 }, second] })))
  mount(); await ready()
  const titles = within(screen.getByRole('region', { name: 'Cortinas' })).getAllByRole('heading', { level: 3 })
  expect(titles.map((heading) => heading.textContent)).toEqual(['Cortina 9', 'Cortina 2'])
})
test('uses expired and lateInstallation flags even when dates suggest otherwise', async () => {
  server.use(http.get('*/orcamentos/quote-1', () => HttpResponse.json({ ...quoteFixture, status: 'SENT', expired: true, lateInstallation: true, validUntil: '2099-10-01T12:00:00Z', scheduledInstallationAt: '2099-10-02T12:00:00Z' })))
  mount(); await ready()
  expect(screen.getByText('Expirado')).toBeVisible()
  expect(screen.getByText('Instalação em atraso')).toBeVisible()
  expect(screen.getByRole('link', { name: 'Editar orçamento' })).toBeVisible()
})
test('never derives lateness or expiration locally from old dates', async () => {
  server.use(http.get('*/orcamentos/quote-1', () => HttpResponse.json({ ...quoteFixture, status: 'SENT', expired: false, lateInstallation: false, validUntil: '2000-10-01T12:00:00Z', scheduledInstallationAt: '2000-10-02T12:00:00Z' })))
  mount(); await ready()
  expect(screen.queryByText('Expirado')).not.toBeInTheDocument()
  expect(screen.queryByText('Instalação em atraso')).not.toBeInTheDocument()
})
test.each(['DRAFT', 'SENT', 'CONFIRMED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED'] as const)('keeps editing navigation and does not request documents in %s', async (status) => {
  const pdf = vi.fn(() => new HttpResponse('unused'))
  server.use(http.get('*/orcamentos/quote-1', () => HttpResponse.json({ ...quoteFixture, status })), http.get('*/orcamentos/quote-1/pdf', pdf))
  mount(); await ready()
  if (status === 'DRAFT' || status === 'SENT') expect(screen.getByRole('link', { name: 'Editar orçamento' })).toHaveAttribute('href', '/orcamentos/quote-1/editar')
  else expect(screen.queryByRole('link', { name: 'Editar orçamento' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Gerar PDF' }) !== null).toBe(status !== 'DRAFT' && status !== 'CANCELLED')
  expect(pdf).not.toHaveBeenCalled()
})
test('keeps quote and history accessible when customer data returns 404', async () => {
  server.use(http.get('*/clientes/customer-1', () => new HttpResponse(null, { status: 404 })))
  mount(); await ready()
  expect(await screen.findByText('Cadastro do cliente indisponível. O orçamento foi preservado.')).toBeVisible()
  expect(await screen.findByText('Nenhum evento registrado.')).toBeVisible()
  expect(screen.getByRole('region', { name: 'Totais salvos' })).toBeVisible()
})
test('renders missing collections and optional data explicitly', async () => {
  server.use(http.get('*/orcamentos/quote-1', () => HttpResponse.json({ ...quoteFixture, curtains: [], installationAddress: null })))
  mount(); await ready()
  expect(screen.getByText('Nenhuma cortina cadastrada.')).toBeVisible()
  expect(screen.getByText('Nenhum adicional geral cadastrado.')).toBeVisible()
  expect(screen.getByText('Endereço de instalação não informado.')).toBeVisible()
})
test('preserves server history order, translates events and renders only known details', async () => {
  server.use(http.get('*/orcamentos/quote-1/historico', () => HttpResponse.json([
    { id: 'z', eventType: 'QUOTE_RENEWED', occurredAt: '2026-10-02T12:00:00Z', details: { previousValidUntil: '2026-10-02T12:00:00Z', newValidUntil: '2026-11-02T12:00:00Z', private: 'secret diagnostic' } },
    { id: 'a', eventType: 'QUOTE_EDITED', occurredAt: '2026-10-01T12:00:00Z', details: { changes: [{ field: 'height', previous: 2.6, next: 2.65, curtainSequence: 1, curtainRoom: 'Sala' }], future: 'secret diagnostic' } },
  ])))
  mount()
  const history = await screen.findByRole('region', { name: 'Histórico do orçamento' })
  await within(history).findByText('Orçamento editado')
  expect(within(history).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    expect.stringContaining('Orçamento renovado'), expect.stringContaining('Orçamento editado'),
  ])
  expect(within(history).getByText('Cortina 1 · Sala — Altura: 2,6 → 2,65')).toBeVisible()
  expect(within(history).getByText('02/10/2026 às 09:00')).toBeVisible()
  expect(screen.queryByText('secret diagnostic')).not.toBeInTheDocument()
})
test('history failure retries independently while the quote remains visible', async () => {
  server.use(http.get('*/orcamentos/quote-1/historico', () => new HttpResponse(null, { status: 500 })))
  mount(); await ready()
  const history = screen.getByRole('region', { name: 'Histórico do orçamento' })
  expect(await within(history).findByRole('alert')).toBeVisible()
  expect(screen.getByRole('region', { name: 'Cortinas' })).toBeVisible()
  server.use(http.get('*/orcamentos/quote-1/historico', () => HttpResponse.json([])))
  fireEvent.click(within(history).getByRole('button', { name: 'Tentar novamente' }))
  expect(await within(history).findByText('Nenhum evento registrado.')).toBeVisible()
})
test('404 does not query history or render actions', async () => {
  const history = vi.fn(() => HttpResponse.json([]))
  server.use(http.get('*/orcamentos/quote-1', () => new HttpResponse(null, { status: 404 })), http.get('*/orcamentos/quote-1/historico', history))
  mount(); expect(await screen.findByText('Orçamento não encontrado.')).toBeVisible()
  expect(screen.queryByRole('link', { name: 'Editar orçamento' })).not.toBeInTheDocument()
  expect(history).not.toHaveBeenCalled()
})
test('retries the detail after failure without a false empty quote', async () => {
  server.use(http.get('*/orcamentos/quote-1', () => new HttpResponse(null, { status: 500 })))
  mount(); expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.queryByRole('region', { name: 'Cortinas' })).not.toBeInTheDocument()
  server.use(http.get('*/orcamentos/quote-1', () => HttpResponse.json(quoteFixture)))
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' })); await ready()
})
test('shows loading while waiting for the detail', async () => {
  server.use(http.get('*/orcamentos/quote-1', () => new Promise<Response>(() => {})))
  mount(); expect(await screen.findByText('Carregando orçamento…')).toBeVisible()
  expect(screen.queryByRole('region', { name: 'Cortinas' })).not.toBeInTheDocument()
})
test('delegates detail 401 to the session boundary', async () => {
  server.use(http.get('*/orcamentos/quote-1', () => new HttpResponse(null, { status: 401 })))
  mount(); expect(await screen.findByLabelText('Senha')).toBeVisible()
})
test('edit link opens the implemented edit page', async () => {
  mount(); await ready()
  fireEvent.click(screen.getByRole('link', { name: 'Editar orçamento' }))
  expect(await screen.findByLabelText('Observações')).toBeVisible()
  await waitFor(() => expect(document.title).toBe('Editar orçamento | Cortinando ERP'))
})

test('shows independent history loading without a false empty state', async () => {
  server.use(http.get('*/orcamentos/quote-1/historico', () => new Promise<Response>(() => {})))
  mount(); await ready()
  expect(await screen.findByText('Carregando histórico…')).toBeVisible()
  expect(screen.queryByText('Nenhum evento registrado.')).not.toBeInTheDocument()
})
test('retries customer lookup independently of the preserved quote', async () => {
  server.use(http.get('*/clientes/customer-1', () => new HttpResponse(null, { status: 500 })))
  mount(); await ready()
  const customer = screen.getByRole('region', { name: 'Cliente do orçamento' })
  expect(await within(customer).findByRole('alert')).toBeVisible()
  expect(screen.getByRole('region', { name: 'Totais salvos' })).toBeVisible()
  server.use(http.get('*/clientes/customer-1', () => HttpResponse.json(customerFixture)))
  fireEvent.click(within(customer).getByRole('button', { name: 'Tentar novamente' }))
  expect(await within(customer).findByText(customerFixture.name)).toBeVisible()
})
test('delegates a history 401 to the session boundary', async () => {
  server.use(http.get('*/orcamentos/quote-1/historico', () => new HttpResponse(null, { status: 401 })))
  mount(); expect(await screen.findByLabelText('Senha')).toBeVisible()
})
