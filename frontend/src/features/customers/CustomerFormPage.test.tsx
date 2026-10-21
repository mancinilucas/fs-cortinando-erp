import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { http, HttpResponse } from 'msw'
import { beforeEach, expect, test, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { AppRoutes } from '@/app/router'
import { server } from '@/shared/test/server'
import { customerFixture } from './fixtures.test-support'

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  server.use(http.get('*/auth/me', () => HttpResponse.json({ id: 'user-1', email: 'session@example.test' })),
    http.get('*/clientes/customer-1', () => HttpResponse.json(customerFixture)),
    http.get('*/clientes/customer-1/orcamentos', () => HttpResponse.json([])))
})
function Probe() { const location = useLocation(); return <output aria-label="Location">{location.pathname}</output> }
function mount(path = '/clientes/novo') {
  return render(<AppProviders><MemoryRouter initialEntries={[path]}><AppRoutes /><Probe /></MemoryRouter></AppProviders>)
}
async function fillRequired() {
  const name = await screen.findByLabelText('Nome (obrigatório)')
  fireEvent.change(name, { target: { value: 'Ana' } })
  fireEvent.change(screen.getByLabelText('Telefone (obrigatório)'), { target: { value: '11912345678' } })
}
function submitCreate() { fireEvent.click(screen.getByRole('button', { name: 'Criar cliente' })) }

test('validates required fields and focuses the first error without sending a request', async () => {
  const handler = vi.fn(() => HttpResponse.json(customerFixture))
  server.use(http.post('*/clientes', handler))
  mount(); await screen.findByLabelText('Nome (obrigatório)'); submitCreate()
  expect(await screen.findByText('Informe o nome.')).toBeVisible()
  expect(screen.getByText('Informe o telefone.')).toBeVisible()
  await waitFor(() => expect(screen.getByLabelText('Nome (obrigatório)')).toHaveFocus())
  expect(handler).not.toHaveBeenCalled()
})
test('creates with null optional fields and navigates to the existing detail route', async () => {
  const handler = vi.fn(async ({ request }: { request: Request }) => {
    expect(await request.json()).toEqual({ name: 'Ana', phone: '11912345678', email: null, taxId: null, notes: null, address: null })
    return HttpResponse.json(customerFixture, { status: 201 })
  })
  server.use(http.post('*/clientes', handler))
  mount(); await fillRequired(); submitCreate()
  expect(await screen.findByRole('heading', { name: 'Cliente' })).toBeVisible()
  expect(screen.getByLabelText('Location')).toHaveTextContent('/clientes/customer-1')
  expect(handler).toHaveBeenCalledOnce()
})
test('shows conditional address fields and blocks incomplete address submission', async () => {
  mount(); await fillRequired()
  expect(screen.queryByLabelText('Rua (obrigatório)')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('switch', { name: 'Adicionar endereço' }))
  submitCreate()
  expect(await screen.findByText('Informe a rua.')).toBeVisible()
  expect(screen.getByText('Informe o número.')).toBeVisible()
  expect(screen.getByText('Informe o bairro.')).toBeVisible()
  expect(screen.getByText('Informe a cidade.')).toBeVisible()
})
test('creates a complete address with optional fields empty and textual number', async () => {
  server.use(http.post('*/clientes', async ({ request }) => {
    expect(await request.json()).toMatchObject({ address: { street: 'Rua A', number: 's/n', neighborhood: 'Centro', city: 'Campinas', postalCode: null, complement: null, state: null } })
    return HttpResponse.json(customerFixture, { status: 201 })
  }))
  mount(); await fillRequired(); fireEvent.click(screen.getByRole('switch'))
  for (const [label, value] of [['Rua', 'Rua A'], ['Número', 's/n'], ['Bairro', 'Centro'], ['Cidade', 'Campinas']]) {
    fireEvent.change(screen.getByLabelText(`${label} (obrigatório)`), { target: { value } })
  }
  submitCreate()
  await screen.findByRole('heading', { name: 'Cliente' })
})
test('loads edit defaults, avoids empty PATCH and uses server detail as the new baseline', async () => {
  const saved = { ...customerFixture, name: 'Nome normalizado no servidor' }
  server.use(http.patch('*/clientes/customer-1', async ({ request }) => {
    expect(await request.json()).toEqual({ name: 'Changed' })
    return HttpResponse.json(saved)
  }))
  mount('/clientes/customer-1/editar')
  const name = await screen.findByLabelText('Nome (obrigatório)')
  expect(name).toHaveValue(customerFixture.name)
  expect(screen.getByRole('switch')).toBeChecked()
  expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled()
  fireEvent.change(name, { target: { value: 'Changed' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
  expect(await screen.findByText('Cliente atualizado.')).toBeVisible()
  expect(name).toHaveValue(saved.name)
  expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled()
})
test('removing an existing address sends null without any unchanged scalar', async () => {
  server.use(http.patch('*/clientes/customer-1', async ({ request }) => {
    expect(await request.json()).toEqual({ address: null })
    return HttpResponse.json({ ...customerFixture, address: null })
  }))
  mount('/clientes/customer-1/editar'); await screen.findByLabelText('Nome (obrigatório)')
  fireEvent.click(screen.getByRole('switch'))
  expect(screen.queryByLabelText('Rua (obrigatório)')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
  await screen.findByText('Cliente atualizado.')
})
test('clearing optional fields sends null and editing one address field sends the full block', async () => {
  server.use(http.get('*/clientes/customer-1', () => HttpResponse.json({ ...customerFixture, email: 'old@example.test' })),
    http.patch('*/clientes/customer-1', async ({ request }) => {
      expect(await request.json()).toEqual({ email: null, address: { ...customerFixture.address, number: '123A' } })
      return HttpResponse.json({ ...customerFixture, address: { ...customerFixture.address!, number: '123A' } })
    }))
  mount('/clientes/customer-1/editar'); await screen.findByLabelText('Nome (obrigatório)')
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: '' } })
  fireEvent.change(screen.getByLabelText('Número (obrigatório)'), { target: { value: '123A' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
  await screen.findByText('Cliente atualizado.')
})
test.each([400, 500, 'network'] as const)('preserves input and shows safe backend failure %s', async (failure) => {
  server.use(http.post('*/clientes', () => failure === 'network' ? HttpResponse.error() : HttpResponse.json({ message: 'private backend diagnostic' }, { status: failure })))
  mount(); await fillRequired(); submitCreate()
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.queryByText(/private backend/)).not.toBeInTheDocument()
  expect(screen.getByLabelText('Nome (obrigatório)')).toHaveValue('Ana')
  expect(screen.getByRole('button', { name: 'Criar cliente' })).toBeEnabled()
})
test('locks submission while saving', async () => {
  let finish!: () => void
  const pending = new Promise<void>((resolve) => { finish = resolve })
  const handler = vi.fn(async () => { await pending; return HttpResponse.json(customerFixture, { status: 201 }) })
  server.use(http.post('*/clientes', handler))
  mount(); await fillRequired(); submitCreate()
  const button = await screen.findByRole('button', { name: 'Salvando…' })
  expect(button).toBeDisabled()
  fireEvent.click(button)
  await waitFor(() => expect(handler).toHaveBeenCalledOnce())
  finish()
  await screen.findByRole('heading', { name: 'Cliente' })
})
test('shows edit loading and fetch failure with retry instead of an empty form', async () => {
  server.use(http.get('*/clientes/customer-1', () => new HttpResponse(null, { status: 404 })))
  mount('/clientes/customer-1/editar')
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.queryByLabelText('Nome (obrigatório)')).not.toBeInTheDocument()
  server.use(http.get('*/clientes/customer-1', () => HttpResponse.json(customerFixture)))
  fireEvent.click(screen.getByText('Tentar novamente'))
  expect(await screen.findByLabelText('Nome (obrigatório)')).toHaveValue(customerFixture.name)
})
