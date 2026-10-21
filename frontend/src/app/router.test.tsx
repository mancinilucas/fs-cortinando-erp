import type { ReactNode } from 'react'
import { http, HttpResponse } from 'msw'
import { server } from '@/shared/test/server'
import { AppProviders } from './providers'
import { render as renderView, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Outlet, useLocation } from 'react-router'
import { beforeEach, expect, test } from 'vitest'
import { AppRoutes } from './router'
import { productRoutes } from './route-definitions'

beforeEach(() => {
  server.use(http.get('*/auth/me', () => new HttpResponse(null, { status: 401 })))
})

function render(view: ReactNode) { return renderView(<AppProviders>{view}</AppProviders>) }

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="Caminho">{location.pathname}{location.search}</output>
}

const productPaths = [
  '/dashboard', '/clientes', '/clientes/novo', '/clientes/customer-1',
  '/clientes/customer-1/editar', '/clientes/customer-1/orcamentos/novo',
  '/orcamentos', '/orcamentos/quote-1', '/orcamentos/quote-1/editar',
  '/configuracoes/dados-do-negocio',
]

test.each(['/', ...productPaths])('keeps %s inaccessible before the session boundary exists', (path) => {
  render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>)
  expect(screen.getByRole('heading', { level: 1, name: 'Cortinando ERP' })).toBeVisible()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})

test.each([['/login', 'Entrar'], ['/missing', 'Página não encontrada']])('renders public skeleton %s', (path, title) => {
  render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: title })).toBeVisible()
  expect(document.title).toBe(`${title} | Cortinando ERP`)
})

test('redirects root when the integration boundary releases its outlet', async () => {
  render(<MemoryRouter initialEntries={['/']}><AppRoutes protectedElement={<Outlet />} /><LocationProbe /></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await waitFor(() => expect(screen.getByLabelText('Caminho')).toHaveTextContent('/dashboard'))
})

test.each(productRoutes)('resolves documented skeleton $path after the boundary is released', ({ path, title }) => {
  const url = path.replace(':customerId', 'customer-1').replace(':quoteId', 'quote-1')
  render(<MemoryRouter initialEntries={[url]}><AppRoutes protectedElement={<Outlet />} /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: title })).toBeVisible()
  expect(document.title).toBe(`${title} | Cortinando ERP`)
})

test('preserves search params and only creates quotes in customer context', () => {
  render(<MemoryRouter initialEntries={['/orcamentos?search=Maria&status=SENT']}><AppRoutes protectedElement={<Outlet />} /><LocationProbe /></MemoryRouter>)
  expect(screen.getByLabelText('Caminho')).toHaveTextContent('/orcamentos?search=Maria&status=SENT')
  expect(productRoutes.filter((route) => route.title === 'Novo orçamento').map((route) => route.path))
    .toEqual(['/clientes/:customerId/orcamentos/novo'])
})

test.each(['/orcamentos/q/enviar', '/orcamentos/q/instalacao', '/orcamentos/q/pdf'])('does not add an action route at %s', (path) => {
  render(<MemoryRouter initialEntries={[path]}><AppRoutes protectedElement={<Outlet />} /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
})
