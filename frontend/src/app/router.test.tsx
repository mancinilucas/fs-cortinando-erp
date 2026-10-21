import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { http, HttpResponse } from 'msw'
import { beforeEach, expect, test, vi } from 'vitest'
import { emptyDashboardFixture } from '@/features/dashboard/fixtures.test-support'
import { server } from '@/shared/test/server'
import { AppProviders } from './providers'
import { AppRoutes } from './router'
import { productRoutes } from './route-definitions'

const user = { id: 'user-1', email: 'user@example.test' }
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  server.use(http.get('*/auth/me', () => HttpResponse.json(user)), http.get('*/dashboard', () => HttpResponse.json(emptyDashboardFixture)), http.get('*/clientes', () => HttpResponse.json([])))
})
function LocationProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return <><output aria-label="Caminho">{location.pathname}{location.search}{location.hash}</output>
    <button onClick={() => { void navigate(-1) }}>Browser back</button></>
}
function mount(path = '/dashboard') {
  return render(<AppProviders><MemoryRouter initialEntries={[path]}><AppRoutes /><LocationProbe /></MemoryRouter></AppProviders>)
}
const productPaths = productRoutes.map(({ path }) => path.replace(':customerId', 'customer-1').replace(':quoteId', 'quote-1'))

test.each(['/', ...productPaths])('blocks anonymous access to %s and redirects safely', async (path) => {
  server.use(http.get('*/auth/me', () => new HttpResponse(null, { status: 401 })))
  mount(path)
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeVisible()
  const destination = path === '/' ? '/login' : `/login?returnTo=${encodeURIComponent(path)}`
  expect(screen.getByLabelText('Caminho')).toHaveTextContent(destination)
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
})

test('does not mount shell or product content while bootstrap is pending', () => {
  server.use(http.get('*/auth/me', () => new Promise<Response>(() => {})))
  mount('/clientes')
  expect(within(screen.getByRole('main')).getByRole('status')).toHaveTextContent('Verificando sessão')
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  expect(screen.queryByText('Esta página será implementada nas próximas etapas.')).not.toBeInTheDocument()
})

test.each([500, 'network'] as const)('keeps bootstrap failure %s on the current route with retry', async (status) => {
  server.use(http.get('*/auth/me', () => status === 'network' ? HttpResponse.error() : new HttpResponse(null, { status })))
  mount('/orcamentos')
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.getByLabelText('Caminho')).toHaveTextContent('/orcamentos')
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  server.use(http.get('*/auth/me', () => HttpResponse.json(user)), http.get('*/dashboard', () => HttpResponse.json(emptyDashboardFixture)), http.get('*/clientes', () => HttpResponse.json([])))
  fireEvent.click(screen.getByText('Tentar novamente'))
  expect(await screen.findByRole('heading', { name: 'Orçamentos' })).toBeVisible()
})

test('redirects authenticated root to dashboard', async () => {
  mount('/')
  expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeVisible()
  expect(screen.getByLabelText('Caminho')).toHaveTextContent('/dashboard')
})

test.each(productRoutes)('renders protected shell for $path with the correct title', async ({ path, title }) => {
  mount(path.replace(':customerId', 'customer-1').replace(':quoteId', 'quote-1'))
  expect(await screen.findByRole('heading', { name: title })).toBeVisible()
  expect(document.title).toBe(`${title} | Cortinando ERP`)
  expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
  expect(screen.getByRole('button', { name: 'Sair' })).toBeEnabled()
})

test.each([
  ['/clientes/customer-1/editar', 'Clientes'],
  ['/clientes/customer-1/orcamentos/novo', 'Clientes'],
  ['/orcamentos/quote-1/editar', 'Orçamentos'],
  ['/configuracoes/dados-do-negocio', 'Configurações'],
] as const)('marks the parent destination active for %s', async (path, label) => {
  mount(path)
  const desktop = await screen.findByRole('navigation', { name: 'Navegação principal desktop' })
  const mobile = screen.getByRole('navigation', { name: 'Navegação principal mobile' })
  for (const nav of [desktop, mobile]) {
    expect(within(nav).getAllByRole('link')).toHaveLength(4)
    expect(within(nav).getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page')
  }
})

test('preserves filters and browser back while moving focus and scrolling on route changes', async () => {
  mount('/clientes?search=Maria')
  const heading = await screen.findByRole('heading', { name: 'Clientes' })
  await waitFor(() => expect(heading).toHaveFocus())
  const nav = screen.getByRole('navigation', { name: 'Navegação principal mobile' })
  fireEvent.click(within(nav).getByRole('link', { name: 'Orçamentos' }))
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Orçamentos' })).toHaveFocus())
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
  fireEvent.click(screen.getByText('Browser back'))
  await waitFor(() => expect(screen.getByLabelText('Caminho')).toHaveTextContent('/clientes?search=Maria'))
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Clientes' })).toHaveFocus())
})

test.each([
  ['/clientes/novo', '/clientes'], ['/clientes/customer-1', '/clientes'],
  ['/clientes/customer-1/editar', '/clientes/customer-1'],
  ['/clientes/customer-1/orcamentos/novo', '/clientes/customer-1'],
  ['/orcamentos/quote-1', '/orcamentos'], ['/orcamentos/quote-1/editar', '/orcamentos/quote-1'],
])('provides an explicit back destination for %s', async (path, target) => {
  mount(path)
  expect(await screen.findByRole('link', { name: 'Voltar' })).toHaveAttribute('href', target)
})

test('preserves anonymous deep-link query and hash in returnTo', async () => {
  server.use(http.get('*/auth/me', () => new HttpResponse(null, { status: 401 })))
  mount('/orcamentos?status=SENT#historico')
  await screen.findByRole('heading', { name: 'Entrar' })
  expect(screen.getByLabelText('Caminho')).toHaveTextContent('/login?returnTo=%2Forcamentos%3Fstatus%3DSENT%23historico')
})

test.each(['/missing', '/orcamentos/q/enviar', '/orcamentos/q/instalacao', '/orcamentos/q/pdf'])('renders public NotFound at %s without adding an action route', async (path) => {
  server.use(http.get('*/auth/me', () => new HttpResponse(null, { status: 401 })))
  mount(path)
  expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Ir para o dashboard' })).toHaveAttribute('href', '/dashboard')
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('heading')).toHaveFocus())
})

test('keeps login public without the shell', async () => {
  server.use(http.get('*/auth/me', () => new HttpResponse(null, { status: 401 })))
  mount('/login')
  expect(await screen.findByLabelText('Senha')).toBeVisible()
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Entrar' })).toHaveFocus())
})

test('connects successful shell logout and prevents history from reopening private content', async () => {
  server.use(http.post('*/auth/logout', () => new HttpResponse(null, { status: 204 })))
  mount('/clientes')
  const nav = await screen.findByRole('navigation', { name: 'Navegação principal desktop' })
  fireEvent.click(within(nav).getByRole('link', { name: 'Orçamentos' }))
  await screen.findByRole('heading', { name: 'Orçamentos' })
  fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
  expect(await screen.findByLabelText('Senha')).toBeVisible()
  await waitFor(() => expect(screen.getByLabelText('Caminho')).toHaveTextContent(/^\/login$/))
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('Browser back'))
  await waitFor(() => expect(screen.getByLabelText('Caminho')).toHaveTextContent(/^\/login$/))
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
})

test('keeps the shell and current page when logout fails', async () => {
  server.use(http.post('*/auth/logout', () => new HttpResponse(null, { status: 500 })))
  mount('/clientes')
  fireEvent.click(await screen.findByRole('button', { name: 'Sair' }))
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Clientes' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Sair' })).toBeEnabled()
})
