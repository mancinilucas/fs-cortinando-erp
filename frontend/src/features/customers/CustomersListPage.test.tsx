import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { AppRoutes } from '@/app/router'
import { server } from '@/shared/test/server'

const customers = [
  { id: 'customer-z', name: 'Zélia de Oliveira', phone: '11912345678', email: null },
  { id: 'customer-a', name: 'Ana Souza', phone: '11987654321', email: 'ana@example.test' },
]
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  server.use(http.get('*/auth/me', () => HttpResponse.json({ id: 'user-1', email: 'session@example.test' })),
    http.get('*/clientes', () => HttpResponse.json(customers)), http.get('*/dashboard', () => HttpResponse.json({
      statusCounts: { draft: 0, sent: 0, expired: 0, confirmed: 0, inProduction: 0 },
      upcomingInstallations: [], weeklyInstallations: [], overdueInstallations: [],
    })))
})
afterEach(() => { vi.useRealTimers() })
function Probe() {
  const location = useLocation()
  const navigate = useNavigate()
  return <><output aria-label="Location">{location.pathname}{location.search}</output>
    <button onClick={() => { void navigate(-1) }}>Browser back</button>
    <button onClick={() => { void navigate('/clientes?search=Jo') }}>Navigate search</button></>
}
function mount(entries = ['/clientes']) {
  return render(<AppProviders><MemoryRouter initialEntries={entries}><AppRoutes /><Probe /></MemoryRouter></AppProviders>)
}
async function ready() { return screen.findByRole('link', { name: /Zélia de Oliveira/ }) }
function input() { return screen.getByRole('searchbox', { name: 'Buscar por nome' }) }
async function advanceDebounce() {
  await act(async () => { await vi.advanceTimersByTimeAsync(300); await vi.advanceTimersByTimeAsync(20) })
  vi.useRealTimers()
}

test('renders only server results, in server order, with contacts and detail links', async () => {
  mount(); await ready()
  const list = screen.getByRole('region', { name: 'Resultados de clientes' })
  const links = within(list).getAllByRole('link')
  expect(links.map((link) => link.getAttribute('href'))).toEqual(['/clientes/customer-z', '/clientes/customer-a'])
  expect(within(list).getByText('11912345678')).toBeVisible()
  expect(within(list).getByText('ana@example.test')).toBeVisible()
  expect(within(list).queryByRole('table')).not.toBeInTheDocument()
})

test('initial deep-link search is sent unchanged and does not filter returned customers locally', async () => {
  const terms: string[] = []
  server.use(http.get('*/clientes', ({ request }) => {
    terms.push(new URL(request.url).searchParams.get('search') ?? '')
    return HttpResponse.json(customers)
  }))
  mount(['/clientes?search=%C3%81na+%26+%25_'])
  await ready()
  expect(input()).toHaveValue('Ána & %_')
  expect(terms).toEqual(['Ána & %_'])
  expect(screen.getByRole('link', { name: /Zélia de Oliveira/ })).toBeVisible()
})

test('debounces changes, preserves unrelated params and retains input focus', async () => {
  const terms: string[] = []
  server.use(http.get('*/clientes', ({ request }) => { terms.push(new URL(request.url).searchParams.get('search') ?? ''); return HttpResponse.json(customers) }))
  mount(['/clientes?context=preserved']); await ready()
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Clientes' })).toHaveFocus())
  input().focus()
  fireEvent.change(input(), { target: { value: 'A' } })
  fireEvent.change(input(), { target: { value: 'Ana' } })
  expect(terms).toEqual([''])
  expect(screen.getByText('Buscando clientes…')).toBeVisible()
  await waitFor(() => expect(terms).toEqual(['', 'Ana']))
  await ready()
  expect(screen.getByLabelText('Location')).toHaveTextContent('/clientes?context=preserved&search=Ana')
  expect(input()).toHaveFocus()
})

test('clearing search removes its URL parameter and requests all customers', async () => {
  const terms: string[] = []
  server.use(http.get('*/clientes', ({ request }) => { terms.push(new URL(request.url).searchParams.get('search') ?? ''); return HttpResponse.json(customers) }))
  mount(['/clientes?search=Ana&context=preserved']); await ready()
  fireEvent.change(input(), { target: { value: '' } })
  await waitFor(() => expect(terms).toEqual(['Ana', '']))
  expect(screen.getByLabelText('Location')).toHaveTextContent('/clientes?context=preserved')
})

test('browser back restores URL/input and cancels a pending draft without overwriting history', async () => {
  mount(['/clientes?search=Ana']); await ready()
  fireEvent.click(screen.getByText('Navigate search'))
  await waitFor(() => expect(input()).toHaveValue('Jo'))
  await ready()
  vi.useFakeTimers()
  fireEvent.change(input(), { target: { value: 'uncommitted' } })
  fireEvent.click(screen.getByText('Browser back'))
  await act(async () => { await vi.advanceTimersByTimeAsync(300); await vi.advanceTimersByTimeAsync(20) })
  vi.useRealTimers()
  await waitFor(() => expect(input()).toHaveValue('Ana'))
  expect(screen.getByLabelText('Location')).toHaveTextContent('/clientes?search=Ana')
})

test('debounced changes replace history instead of adding a new entry per term', async () => {
  mount(['/dashboard', '/clientes']); await ready()
  fireEvent.change(input(), { target: { value: 'Ana' } })
  await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent('/clientes?search=Ana'))
  await ready()
  fireEvent.click(screen.getByText('Browser back'))
  expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeVisible()
})

test('leaving the page cancels the pending debounce', async () => {
  const terms: string[] = []
  server.use(http.get('*/clientes', ({ request }) => { terms.push(new URL(request.url).searchParams.get('search') ?? ''); return HttpResponse.json(customers) }))
  mount(); await ready()
  vi.useFakeTimers()
  fireEvent.change(input(), { target: { value: 'uncommitted' } })
  fireEvent.click(screen.getByRole('link', { name: 'Novo cliente' }))
  await advanceDebounce()
  expect(screen.getByRole('heading', { name: 'Novo cliente' })).toBeVisible()
  expect(terms).toEqual([''])
})

test('opens a customer detail with the keyboard', async () => {
  const user = userEvent.setup()
  mount(); const link = await ready()
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Clientes' })).toHaveFocus())
  link.focus(); await user.keyboard('{Enter}')
  expect(await screen.findByRole('heading', { name: 'Cliente' })).toBeVisible()
  expect(screen.getByLabelText('Location')).toHaveTextContent('/clientes/customer-z')
})

test.each([['/clientes', 'Nenhum cliente cadastrado.'], ['/clientes?search=Ana', 'Nenhum cliente encontrado para esta busca.']])('shows the empty state for %s and keeps creation available', async (path, message) => {
  server.use(http.get('*/clientes', () => HttpResponse.json([])))
  mount([path])
  expect(await screen.findByText(message)).toBeVisible()
  expect(screen.getByRole('link', { name: 'Novo cliente' })).toHaveAttribute('href', '/clientes/novo')
})

test('shows loading without a false empty state', async () => {
  server.use(http.get('*/clientes', () => new Promise<Response>(() => {})))
  mount()
  expect(await screen.findByText('Buscando clientes…')).toBeVisible()
  expect(screen.queryByText('Nenhum cliente cadastrado.')).not.toBeInTheDocument()
})

test.each([500, 'network'] as const)('shows safe %s errors and retries manually', async (failure) => {
  const handler = vi.fn(() => failure === 'network' ? HttpResponse.error() : HttpResponse.json({ message: 'private' }, { status: 500 }))
  server.use(http.get('*/clientes', handler))
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir a operação. Tente novamente.')
  expect(handler).toHaveBeenCalledOnce()
  server.use(http.get('*/clientes', () => HttpResponse.json(customers)))
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await ready()
})

test('delegates 401 to the existing session boundary with the search destination', async () => {
  server.use(http.get('*/clientes', () => new HttpResponse(null, { status: 401 })))
  mount(['/clientes?search=Ana'])
  expect(await screen.findByLabelText('Senha')).toBeVisible()
  expect(screen.getByLabelText('Location')).toHaveTextContent('/login?returnTo=%2Fclientes%3Fsearch%3DAna')
})
