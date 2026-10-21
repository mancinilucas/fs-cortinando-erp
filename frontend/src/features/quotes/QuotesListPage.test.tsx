import { quoteFixture } from '@/features/quotes/fixtures.test-support'
import { customerFixture } from '@/features/customers/fixtures.test-support'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { AppRoutes } from '@/app/router'
import { server } from '@/shared/test/server'
import { quoteSummaryFixture } from './fixtures.test-support'

const quotes = [{ ...quoteSummaryFixture, id: 'z', scheduledInstallationAt: '2026-10-21T15:00:00Z' },
  { ...quoteSummaryFixture, id: 'a', quoteNumber: 'ORC-2026-002', expired: false }]
beforeEach(() => {
  server.use(http.get('*/orcamentos/:id', ({ params }) => HttpResponse.json({ ...quoteFixture, id: params.id })),
    http.get('*/orcamentos/:id/historico', () => HttpResponse.json([])),
    http.get('*/clientes/customer-1', () => HttpResponse.json(customerFixture)))
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  server.use(http.get('*/auth/me', () => HttpResponse.json({ id: 'user-1', email: 'session@example.test' })),
    http.get('*/orcamentos', () => HttpResponse.json(quotes)))
})
afterEach(() => vi.useRealTimers())
function Probe() {
  const location = useLocation(); const navigate = useNavigate()
  return <><output aria-label="Location">{location.pathname}{location.search}</output>
    <button onClick={() => { void navigate(-1) }}>Browser back</button>
    <button onClick={() => { void navigate('/orcamentos?search=Jo&status=DRAFT') }}>Navigate filters</button></>
}
function mount(entries = ['/orcamentos']) { render(<AppProviders><MemoryRouter initialEntries={entries}><AppRoutes /><Probe /></MemoryRouter></AppProviders>) }
const input = () => screen.getByRole('searchbox', { name: 'Buscar por cliente ou número' })
const select = () => screen.getByRole('combobox', { name: 'Situação' })
const ready = () => screen.findByRole('link', { name: /ORC-2026-001/ })

test('renders server order, summary fields and expiration separately without local inference', async () => {
  mount(); await ready()
  const links = within(screen.getByRole('region', { name: 'Resultados de orçamentos' })).getAllByRole('link')
  expect(links.map((link) => link.getAttribute('href'))).toEqual(['/orcamentos/z', '/orcamentos/a'])
  expect(links[0]).toHaveTextContent('Ana')
  expect(links[0]).toHaveTextContent('Enviado')
  expect(links[0]).toHaveTextContent('Expirado')
  expect(links[0]).toHaveTextContent(/9,87/)
  expect(links[0]).toHaveTextContent('Criação: 01/10/2026')
  expect(links[0]).toHaveTextContent('Instalação: 21/10/2026 às 12:00')
  expect(links[1]).not.toHaveTextContent('Instalação:')
  expect(links[1]).not.toHaveTextContent('Expirado')
  expect(screen.queryByRole('link', { name: 'Novo orçamento' })).not.toBeInTheDocument()
})
test('uses deep-link filters literally without filtering returned results locally', async () => {
  const calls: URLSearchParams[] = []
  server.use(http.get('*/orcamentos', ({ request }) => { calls.push(new URL(request.url).searchParams); return HttpResponse.json(quotes) }))
  mount(['/orcamentos?search=%C3%81na+%26+%25_&status=EXPIRED'])
  await ready()
  expect(input()).toHaveValue('Ána & %_'); expect(select()).toHaveValue('EXPIRED')
  expect([...calls[0]]).toEqual([['search', 'Ána & %_'], ['status', 'EXPIRED']])
  expect(screen.getByRole('link', { name: /ORC-2026-002/ })).toBeVisible()
})
test('debounces search and preserves status, unrelated parameters and input focus', async () => {
  const terms: string[] = []
  server.use(http.get('*/orcamentos', ({ request }) => { terms.push(new URL(request.url).searchParams.get('search') ?? ''); return HttpResponse.json(quotes) }))
  mount(['/orcamentos?status=SENT&context=keep']); await ready()
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Orçamentos' })).toHaveFocus())
  input().focus()
  fireEvent.change(input(), { target: { value: 'A' } }); fireEvent.change(input(), { target: { value: 'Ana' } })
  expect(terms).toEqual(['']); expect(screen.getByText('Buscando orçamentos…')).toBeVisible()
  await waitFor(() => expect(terms).toEqual(['', 'Ana']))
  await ready()
  expect(input()).toHaveFocus()
  expect(screen.getByLabelText('Location')).toHaveTextContent('status=SENT&context=keep&search=Ana')
})
test('status selection commits a pending search once and back restores both filters', async () => {
  mount(['/orcamentos?search=Ana&status=SENT']); await ready()
  fireEvent.change(input(), { target: { value: 'Maria' } })
  fireEvent.change(select(), { target: { value: 'CONFIRMED' } })
  await ready()
  expect(input()).toHaveValue('Maria'); expect(select()).toHaveValue('CONFIRMED')
  fireEvent.click(screen.getByText('Browser back'))
  await waitFor(() => expect(input()).toHaveValue('Ana'))
  expect(select()).toHaveValue('SENT')
})
test('clear filters cancels pending search and preserves unrelated parameters', async () => {
  mount(['/orcamentos?search=Ana&status=EXPIRED&context=keep']); await ready()
  vi.useFakeTimers()
  fireEvent.change(input(), { target: { value: 'pending' } })
  fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
  await act(async () => { await vi.advanceTimersByTimeAsync(350) }); vi.useRealTimers()
  await waitFor(() => expect(input()).toHaveValue(''))
  expect(select()).toHaveValue('')
  expect(screen.getByLabelText('Location')).toHaveTextContent('/orcamentos?context=keep')
})
test('navigation wins over a pending search timer', async () => {
  mount(['/orcamentos?search=Ana&status=SENT']); await ready()
  fireEvent.click(screen.getByText('Navigate filters')); await ready()
  expect(input()).toHaveValue('Jo'); expect(select()).toHaveValue('DRAFT')
  vi.useFakeTimers()
  fireEvent.change(input(), { target: { value: 'pending' } })
  fireEvent.click(screen.getByText('Browser back'))
  await act(async () => { await vi.advanceTimersByTimeAsync(350) }); vi.useRealTimers()
  expect(input()).toHaveValue('Ana'); expect(select()).toHaveValue('SENT')
  expect(screen.getByLabelText('Location')).toHaveTextContent('/orcamentos?search=Ana&status=SENT')
})
test('select offers all documented situations and safely ignores unsupported URL status', async () => {
  const handler = vi.fn(({ request }: { request: Request }) => {
    expect(new URL(request.url).searchParams.has('status')).toBe(false)
    return HttpResponse.json(quotes)
  })
  server.use(http.get('*/orcamentos', handler))
  mount(['/orcamentos?status=INVALID']); await ready()
  expect(select()).toHaveValue('')
  expect(within(select()).getAllByRole('option').map((option) => option.getAttribute('value'))).toEqual(['', 'DRAFT', 'SENT', 'EXPIRED', 'CONFIRMED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED'])
})
test.each([['/orcamentos', 'Nenhum orçamento cadastrado.'], ['/orcamentos?status=EXPIRED', 'Nenhum orçamento encontrado para estes filtros.']])('renders empty results for %s', async (path, message) => {
  server.use(http.get('*/orcamentos', () => HttpResponse.json([])))
  mount([path]); expect(await screen.findByText(message)).toBeVisible()
})
test('shows pending requests without a false empty state', async () => {
  server.use(http.get('*/orcamentos', () => new Promise<Response>(() => {})))
  mount(); expect(await screen.findByText('Buscando orçamentos…')).toBeVisible()
  expect(screen.queryByText('Nenhum orçamento cadastrado.')).not.toBeInTheDocument()
})
test.each([500, 'network'] as const)('supports manual retry for %s without exposing diagnostics', async (failure) => {
  const handler = vi.fn(() => failure === 'network' ? HttpResponse.error() : HttpResponse.json({ message: 'private diagnostic' }, { status: 500 }))
  server.use(http.get('*/orcamentos', handler)); mount()
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.queryByText('private diagnostic')).not.toBeInTheDocument()
  expect(handler).toHaveBeenCalledOnce()
  server.use(http.get('*/orcamentos', () => HttpResponse.json(quotes)))
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' })); await ready()
})
test('opens the detail by keyboard', async () => {
  const user = userEvent.setup(); mount(); const link = await ready()
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Orçamentos' })).toHaveFocus())
  link.focus(); await user.keyboard('{Enter}')
  expect(screen.getByLabelText('Location')).toHaveTextContent('/orcamentos/z')
})
test('delegates 401 to the existing session boundary with the full filter destination', async () => {
  server.use(http.get('*/orcamentos', () => new HttpResponse(null, { status: 401 })))
  mount(['/orcamentos?search=Ana&status=SENT'])
  expect(await screen.findByLabelText('Senha')).toBeVisible()
  expect(screen.getByLabelText('Location')).toHaveTextContent('/login?returnTo=%2Forcamentos%3Fsearch%3DAna%26status%3DSENT')
})

test('sends status changes immediately, preserves search and removes the status parameter for all', async () => {
  const calls: string[] = []
  server.use(http.get('*/orcamentos', ({ request }) => {
    const params = new URL(request.url).searchParams
    calls.push(`${params.get('search')}:${params.get('status')}`)
    return HttpResponse.json(quotes)
  }))
  mount(['/orcamentos?search=Ana']); await ready()
  fireEvent.change(select(), { target: { value: 'EXPIRED' } })
  await waitFor(() => expect(calls).toEqual(['Ana:null', 'Ana:EXPIRED']))
  await ready()
  fireEvent.change(select(), { target: { value: '' } })
  await waitFor(() => expect(calls).toEqual(['Ana:null', 'Ana:EXPIRED', 'Ana:null']))
  expect(screen.getByLabelText('Location')).toHaveTextContent('/orcamentos?search=Ana')
})
test('clearing the search input keeps the selected situation', async () => {
  mount(['/orcamentos?search=Ana&status=SENT']); await ready()
  fireEvent.change(input(), { target: { value: '' } })
  await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent('/orcamentos?status=SENT'))
  expect(select()).toHaveValue('SENT')
})
test('does not let a stale request replace results for the current status', async () => {
  let finish!: () => void
  const pending = new Promise<void>((resolve) => { finish = resolve })
  let started = false
  server.use(http.get('*/orcamentos', async ({ request }) => {
    if (new URL(request.url).searchParams.get('status') === 'SENT') {
      started = true; await pending
      return HttpResponse.json([{ ...quotes[0], quoteNumber: 'STALE' }])
    }
    return HttpResponse.json(quotes)
  }))
  mount(['/orcamentos?status=SENT'])
  await waitFor(() => expect(started).toBe(true))
  fireEvent.change(select(), { target: { value: 'DRAFT' } }); await ready()
  await act(async () => { finish(); await pending })
  expect(screen.queryByText('STALE')).not.toBeInTheDocument()
  expect(select()).toHaveValue('DRAFT')
})
