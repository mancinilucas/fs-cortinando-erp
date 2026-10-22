import { quoteFixture } from '@/features/quotes/fixtures.test-support'
import { customerFixture } from '@/features/customers/fixtures.test-support'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { http, HttpResponse } from 'msw'
import { beforeEach, expect, test, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { AppRoutes } from '@/app/router'
import { server } from '@/shared/test/server'
import { dashboardFixture, emptyDashboardFixture } from './fixtures.test-support'

beforeEach(() => {
  server.use(http.get('*/orcamentos/:id', ({ params }) => HttpResponse.json({ ...quoteFixture, id: params.id })),
    http.get('*/orcamentos/:id/historico', () => HttpResponse.json([])),
    http.get('*/clientes/customer-1', () => HttpResponse.json(customerFixture)))
  server.use(http.get('*/orcamentos', () => HttpResponse.json([])))
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  server.use(
    http.get('*/auth/me', () => HttpResponse.json({ id: 'test-user', email: 'session@example.test' })),
    http.get('*/dashboard', () => HttpResponse.json(dashboardFixture)),
  )
})
function LocationProbe() {
  const location = useLocation()
  return <output aria-label="Location">{location.pathname}{location.search}</output>
}
function mount() {
  return render(<AppProviders><MemoryRouter initialEntries={['/dashboard']}><AppRoutes /><LocationProbe /></MemoryRouter></AppProviders>)
}

const cardCases = [
  ['Rascunhos', '17', 'DRAFT'], ['Enviados', '23', 'SENT'], ['Expirados', '11', 'EXPIRED'],
  ['Confirmados', '9', 'CONFIRMED'], ['Em produção', '4', 'IN_PRODUCTION'],
] as const

test('renders five server counters, three lists and only one dashboard request', async () => {
  const handler = vi.fn(() => HttpResponse.json(dashboardFixture))
  server.use(http.get('*/dashboard', handler))
  mount()
  const cards = await screen.findByRole('region', { name: 'Situação dos orçamentos' })
  expect(within(cards).getAllByRole('link')).toHaveLength(5)
  for (const [label, count, status] of cardCases) {
    expect(within(cards).getByRole('link', { name: `${label}: ${count}` })).toHaveAttribute('href', `/orcamentos?status=${status}`)
  }
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3)
  expect(handler).toHaveBeenCalledOnce()
  expect(screen.queryByText(/ver todas/i)).not.toBeInTheDocument()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})

test.each(cardCases)('navigates from %s to its exact filter', async (label, count, status) => {
  mount()
  fireEvent.click(await screen.findByRole('link', { name: `${label}: ${count}` }))
  await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent(`/orcamentos?status=${status}`))
  expect(screen.getByRole('heading', { level: 1, name: 'Orçamentos' })).toBeVisible()
})

test('keeps all five zero cards and an independent empty state per list', async () => {
  server.use(http.get('*/dashboard', () => HttpResponse.json(emptyDashboardFixture)))
  mount()
  const cards = await screen.findByRole('region', { name: 'Situação dos orçamentos' })
  for (const [label] of cardCases) expect(within(cards).getByRole('link', { name: `${label}: 0` })).toBeVisible()
  expect(screen.getByText('Nenhuma próxima instalação.')).toBeVisible()
  expect(screen.getByText('Nenhuma instalação nesta semana.')).toBeVisible()
  expect(screen.getByText('Nenhuma instalação atrasada.')).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('preserves received list order, groups and status even when dates would suggest another classification', async () => {
  const futureOverdue = { ...dashboardFixture.overdueInstallations[0], scheduledInstallationAt: '2099-01-01T15:00:00.000Z' }
  server.use(http.get('*/dashboard', () => HttpResponse.json({ ...dashboardFixture, overdueInstallations: [futureOverdue] })))
  mount()
  const upcoming = await screen.findByRole('region', { name: 'Próximas instalações' })
  const links = within(upcoming).getAllByRole('link')
  expect(links.map((link) => link.getAttribute('href'))).toEqual(['/orcamentos/quote-2', '/orcamentos/quote-1'])
  expect(within(upcoming).getAllByText('Confirmado')).toHaveLength(2)
  expect(within(upcoming).getByText('02/01/2020 às 12:00')).toHaveAttribute('datetime', '2020-01-02T15:00:00.000Z')
  expect(within(upcoming).queryByText('Atrasada')).not.toBeInTheDocument()
  const weekly = screen.getByRole('region', { name: 'Instalações da semana' })
  expect(within(weekly).getByText('Em produção')).toBeVisible()
  const overdue = screen.getByRole('region', { name: 'Instalações atrasadas' })
  expect(within(overdue).getByText('Atrasada')).toBeVisible()
  expect(within(overdue).getByText('Concluído')).toBeVisible()
  expect(within(overdue).getByText('01/01/2099 às 12:00')).toBeVisible()
})

test('opens a quote from an installation using the keyboard', async () => {
  const user = userEvent.setup()
  mount()
  const upcoming = await screen.findByRole('region', { name: 'Próximas instalações' })
  const link = within(upcoming).getAllByRole('link')[0]
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus())
  link.focus()
  await user.keyboard('{Enter}')
  await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent('/orcamentos/quote-2'))
  expect(screen.getByRole('heading', { level: 1, name: 'Orçamento' })).toBeVisible()
})

test('shows a static loading skeleton without fabricated zero counts or empty states', async () => {
  server.use(http.get('*/dashboard', () => new Promise<Response>(() => {})))
  mount()
  expect(await screen.findByRole('status', { name: 'Carregando dashboard' })).toBeVisible()
  expect(screen.queryByRole('region', { name: 'Situação dos orçamentos' })).not.toBeInTheDocument()
  expect(screen.queryByText(/Nenhuma instalação/)).not.toBeInTheDocument()
})

test.each([500, 'network', 'malformed'] as const)('shows a safe %s error and retries only on user action', async (failure) => {
  const handler = vi.fn(() => failure === 'network' ? HttpResponse.error()
    : failure === 'malformed' ? HttpResponse.json({ diagnostic: 'private' })
      : HttpResponse.json({ message: 'private' }, { status: 500 }))
  server.use(http.get('*/dashboard', handler))
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir a operação. Tente novamente.')
  expect(screen.queryByText('private')).not.toBeInTheDocument()
  expect(handler).toHaveBeenCalledOnce()
  server.use(http.get('*/dashboard', () => HttpResponse.json(dashboardFixture)))
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  expect(await screen.findByRole('link', { name: 'Rascunhos: 17' })).toBeVisible()
})

test('delegates expired-session 401 to the existing global login flow', async () => {
  server.use(http.get('*/dashboard', () => new HttpResponse(null, { status: 401 })))
  mount()
  expect(await screen.findByLabelText('Senha')).toBeVisible()
  expect(screen.getByLabelText('Location')).toHaveTextContent('/login?returnTo=%2Fdashboard')
  expect(screen.queryByRole('region', { name: 'Situação dos orçamentos' })).not.toBeInTheDocument()
})

test('does not render extra contact, address, document or financial fields from the response', async () => {
  const sensitive = { phone: 'PHONE-PRIVATE', email: 'EMAIL-PRIVATE', taxId: 'TAX-PRIVATE', address: 'ADDRESS-PRIVATE', totalCents: 987654321 }
  server.use(http.get('*/dashboard', () => HttpResponse.json({
    ...dashboardFixture, ...sensitive,
    upcomingInstallations: [{ ...dashboardFixture.upcomingInstallations[0], ...sensitive }],
  })))
  mount()
  await screen.findByRole('region', { name: 'Próximas instalações' })
  expect(screen.getByRole('main')).not.toHaveTextContent(/PRIVATE|987654321/)
})
