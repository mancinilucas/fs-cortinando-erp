import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { http, HttpResponse } from 'msw'
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { AppRoutes } from '@/app/router'
import { server } from '@/shared/test/server'
import { customerFixture } from '@/features/customers/fixtures.test-support'
import { quoteFixture } from './fixtures.test-support'

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
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  server.use(http.get('*/auth/me', () => HttpResponse.json({ id: 'user-1', email: 'session@example.test' })),
    http.get('*/clientes/customer-1', () => HttpResponse.json(customerFixture)),
    http.get('*/clientes/customer-1/orcamentos', () => HttpResponse.json([])),
    http.get('*/orcamentos/quote-1', () => HttpResponse.json(quoteFixture)))
})
function Probe() { return <output aria-label="Location">{useLocation().pathname}</output> }
function mount(path = '/clientes/customer-1/orcamentos/novo') {
  const router = createMemoryRouter([{ path: '*', element: <><AppRoutes /><Probe /></> }], { initialEntries: [path] })
  render(<AppProviders><RouterProvider router={router} /></AppProviders>)
  return router
}
const notes = () => screen.getByLabelText('Observações')
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
async function ready() { return screen.findByLabelText('Observações') }

test('opens a local draft with a fixed customer and never posts on mount', async () => {
  const post = vi.fn(() => HttpResponse.json(quoteFixture, { status: 201 }))
  server.use(http.post('*/clientes/customer-1/orcamentos', post))
  mount(); await ready()
  const context = screen.getByRole('region', { name: 'Cliente do orçamento' })
  expect(within(context).getByText(customerFixture.name)).toBeVisible()
  expect(within(context).getByText(customerFixture.phone)).toBeVisible()
  expect(within(context).queryByRole('textbox')).not.toBeInTheDocument()
  expect(post).not.toHaveBeenCalled()
})
test('creates on first save, navigates without a discard dialog, then sends only changed fields via PATCH', async () => {
  let current = { ...quoteFixture, notes: 'Server note' }
  const post = vi.fn(async ({ request }: { request: Request }) => {
    expect(await request.json()).toEqual({ notes: 'local note' })
    return HttpResponse.json(current, { status: 201 })
  })
  const patch = vi.fn(async ({ request }: { request: Request }) => {
    expect(await request.json()).toEqual({ notes: 'edited' })
    current = { ...current, notes: 'Server edited' }
    return HttpResponse.json(current)
  })
  server.use(http.post('*/clientes/customer-1/orcamentos', post), http.patch('*/orcamentos/quote-1', patch),
    http.get('*/orcamentos/quote-1', () => HttpResponse.json(current)))
  mount(); await ready()
  fireEvent.change(notes(), { target: { value: 'local note' } }); save()
  await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent('/orcamentos/quote-1/editar'))
  await waitFor(() => expect(notes()).toHaveValue('Server note'))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  fireEvent.change(notes(), { target: { value: 'edited' } }); save()
  expect(await screen.findByText('Rascunho salvo.')).toBeVisible()
  expect(notes()).toHaveValue('Server edited')
  expect(post).toHaveBeenCalledOnce(); expect(patch).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled()
})
test('allows the first save of an empty draft as an empty body', async () => {
  const post = vi.fn(async ({ request }: { request: Request }) => {
    expect(await request.json()).toEqual({})
    return HttpResponse.json(quoteFixture, { status: 201 })
  })
  server.use(http.post('*/clientes/customer-1/orcamentos', post))
  mount(); await ready(); save()
  await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent('/orcamentos/quote-1/editar'))
  expect(post).toHaveBeenCalledOnce()
})
test('creates nested children without ids, sequences or derived fields', async () => {
  const post = vi.fn(async ({ request }: { request: Request }) => {
    const body = await request.json() as { curtains: Array<Record<string, unknown>> }
    expect(body.curtains).toEqual([{ room: 'Sala', description: null, material: null, notes: null, openingWidth: null, borderValue: 0.15, height: null, fabricFactor: 3.5,
      components: [{ name: 'Tecido', quantity: 1.123456, unit: null, unitPriceCents: 29 }] }])
    return HttpResponse.json(quoteFixture, { status: 201 })
  })
  server.use(http.post('*/clientes/customer-1/orcamentos', post))
  mount(); await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar cortina' }))
  fireEvent.change(screen.getByLabelText('Ambiente'), { target: { value: 'Sala' } })
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar componente' }))
  fireEvent.change(screen.getByLabelText('Nome do componente (obrigatório)'), { target: { value: 'Tecido' } })
  fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '1,123456' } })
  fireEvent.change(screen.getByLabelText('Preço unitário (R$)'), { target: { value: '0,29' } }); save()
  await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent('/orcamentos/quote-1/editar'))
  expect(post).toHaveBeenCalledOnce()
})
test('PATCH preserves untouched children when editing a scalar and skips unchanged optional blocks', async () => {
  const patch = vi.fn(async ({ request }: { request: Request }) => {
    expect(await request.json()).toEqual({ notes: 'Only notes' })
    return HttpResponse.json({ ...quoteFixture, notes: 'Only notes' })
  })
  server.use(http.patch('*/orcamentos/quote-1', patch))
  mount('/orcamentos/quote-1/editar'); await ready()
  fireEvent.change(notes(), { target: { value: 'Only notes' } }); save()
  await screen.findByText('Rascunho salvo.')
  expect(screen.getByLabelText('Nome do componente (obrigatório)')).toHaveValue('Tecido')
})
test('PATCH sends the complete altered collection with retained ids and does not accidentally remove siblings', async () => {
  const second = { ...quoteFixture.curtains[0], id: 'curtain-2', room: 'Quarto', components: [] }
  const current = { ...quoteFixture, curtains: [...quoteFixture.curtains, second], generalAddOns: [{ id: 'addon-1', name: 'Frete', quantity: 1, unit: null, unitPriceCents: 100, totalCents: 100 }] }
  const patch = vi.fn(async ({ request }: { request: Request }) => {
    const body = await request.json() as { curtains: Array<{ id: string; room: string; components: Array<{ id: string }> }> }
    expect(Object.keys(body)).toEqual(['curtains'])
    expect(body.curtains.map((curtain) => curtain.id)).toEqual(['curtain-1', 'curtain-2'])
    expect(body.curtains[0].components[0].id).toBe('component-1')
    expect(body.curtains[1].room).toBe('Quarto')
    return HttpResponse.json(current)
  })
  server.use(http.get('*/orcamentos/quote-1', () => HttpResponse.json(current)), http.patch('*/orcamentos/quote-1', patch))
  mount('/orcamentos/quote-1/editar'); await ready()
  fireEvent.change(screen.getAllByLabelText('Ambiente')[0], { target: { value: 'Sala' } }); save()
  await screen.findByText('Rascunho salvo.')
  expect(screen.getByLabelText('Nome do adicional (obrigatório)')).toHaveValue('Frete')
})
test('PATCH clears only the removed components collection while keeping curtain identity', async () => {
  const patch = vi.fn(async ({ request }: { request: Request }) => {
    const body = await request.json() as { curtains: Array<{ id: string; components: unknown[] }> }
    expect(body.curtains).toHaveLength(1)
    expect(body.curtains[0]).toMatchObject({ id: 'curtain-1', components: [] })
    return HttpResponse.json({ ...quoteFixture, curtains: [{ ...quoteFixture.curtains[0], components: [] }] })
  })
  server.use(http.patch('*/orcamentos/quote-1', patch))
  mount('/orcamentos/quote-1/editar'); await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Remover componente' })); save()
  await screen.findByText('Rascunho salvo.')
  expect(screen.getByText('Nenhum componente adicionado.')).toBeVisible()
})
test('PATCH sends changed address as a full block and supports clearing it with null', async () => {
  let calls = 0
  const patch = vi.fn(async ({ request }: { request: Request }) => {
    const body = await request.json()
    calls++
    if (calls === 1) {
      expect(body).toEqual({ installationAddress: { ...quoteFixture.installationAddress, street: 'Rua A' } })
      return HttpResponse.json({ ...quoteFixture, installationAddress: { ...quoteFixture.installationAddress!, street: 'Rua A' } })
    }
    expect(body).toEqual({ installationAddress: null })
    return HttpResponse.json({ ...quoteFixture, installationAddress: null })
  })
  server.use(http.patch('*/orcamentos/quote-1', patch))
  mount('/orcamentos/quote-1/editar'); await ready()
  fireEvent.change(screen.getByLabelText('Rua'), { target: { value: 'Rua A' } }); save(); await screen.findByText('Rascunho salvo.')
  await waitFor(() => expect(screen.getByLabelText('Rua')).toBeEnabled())
  expect(screen.getByLabelText('Rua')).toHaveValue('Rua A')
  fireEvent.change(screen.getByLabelText('Rua'), { target: { value: '' } })
  fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: '' } })
  expect(screen.getByLabelText('Rua')).toHaveValue('')
  expect(screen.getByLabelText('Cidade')).toHaveValue('')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeEnabled())
  save()
  await waitFor(() => expect(patch).toHaveBeenCalledTimes(2))
})
test('does not send an empty PATCH after semantically empty edits', async () => {
  const patch = vi.fn(() => HttpResponse.json(quoteFixture))
  server.use(http.patch('*/orcamentos/quote-1', patch))
  mount('/orcamentos/quote-1/editar'); await ready()
  fireEvent.change(notes(), { target: { value: ' ' } }); save()
  expect(await screen.findByText('Não há alterações para salvar.')).toBeVisible()
  expect(patch).not.toHaveBeenCalled()
})
test('locks duplicate creation while the request is pending', async () => {
  let finish!: () => void
  const pending = new Promise<void>((resolve) => { finish = resolve })
  const post = vi.fn(async () => { await pending; return HttpResponse.json(quoteFixture, { status: 201 }) })
  server.use(http.post('*/clientes/customer-1/orcamentos', post))
  mount(); await ready(); const button = screen.getByRole('button', { name: 'Salvar rascunho' })
  fireEvent.click(button); fireEvent.click(button)
  await waitFor(() => expect(post).toHaveBeenCalledOnce())
  expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled()
  finish()
  await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent('/orcamentos/quote-1/editar'))
})
test.each([400, 422, 500, 'network'] as const)('keeps a failed creation %s local and allows retry', async (status) => {
  server.use(http.post('*/clientes/customer-1/orcamentos', () => status === 'network' ? HttpResponse.error() : HttpResponse.json({ message: 'private diagnostic' }, { status })))
  mount(); await ready(); fireEvent.change(notes(), { target: { value: 'Keep' } }); save()
  expect(await screen.findByRole('alert')).not.toHaveTextContent('private diagnostic')
  expect(notes()).toHaveValue('Keep')
  expect(screen.getByLabelText('Location')).toHaveTextContent('/clientes/customer-1/orcamentos/novo')
  server.use(http.post('*/clientes/customer-1/orcamentos', () => HttpResponse.json(quoteFixture, { status: 201 })))
  save(); await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent('/orcamentos/quote-1/editar'))
})
test('missing customer cannot start a quote and links back to the customer list', async () => {
  server.use(http.get('*/clientes/customer-1', () => new HttpResponse(null, { status: 404 })))
  mount()
  expect(await screen.findByText('Cliente não encontrado ou excluído.')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Salvar rascunho' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute('href', '/clientes')
})
test('missing quote shows an error without creating a new draft', async () => {
  server.use(http.get('*/orcamentos/quote-1', () => new HttpResponse(null, { status: 404 })))
  mount('/orcamentos/quote-1/editar')
  expect(await screen.findByText('Orçamento não encontrado.')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Salvar rascunho' })).not.toBeInTheDocument()
})
test('keeps an existing quote editable when its customer has been removed', async () => {
  server.use(http.get('*/clientes/customer-1', () => new HttpResponse(null, { status: 404 })))
  mount('/orcamentos/quote-1/editar'); await ready()
  expect(await screen.findByText('Cadastro do cliente indisponível.')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Usar endereço do cliente' })).toBeDisabled()
})
test('refetches on conflict and removes editing actions when the server status changed', async () => {
  let current = quoteFixture
  server.use(http.get('*/orcamentos/quote-1', () => HttpResponse.json(current)), http.patch('*/orcamentos/quote-1', () => {
    current = { ...quoteFixture, status: 'CONFIRMED' }
    return new HttpResponse(null, { status: 409 })
  }))
  mount('/orcamentos/quote-1/editar'); await ready()
  fireEvent.change(notes(), { target: { value: 'Changed' } }); save()
  expect(await screen.findByText('Este orçamento não permite edição na situação atual.')).toBeVisible()
  expect(screen.queryByLabelText('Observações')).not.toBeInTheDocument()
})
test('session expiry during save reaches login even when the form was dirty', async () => {
  server.use(http.patch('*/orcamentos/quote-1', () => new HttpResponse(null, { status: 401 })))
  mount('/orcamentos/quote-1/editar'); await ready()
  fireEvent.change(notes(), { target: { value: 'Changed' } }); save()
  expect(await screen.findByLabelText('Senha')).toBeVisible()
})
test('leaving the creation draft without saving requires confirmation', async () => {
  const router = mount(); await ready()
  fireEvent.change(notes(), { target: { value: 'Unsaved' } })
  await act(async () => { await router.navigate('/clientes/customer-1') })
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Continuar editando' }))
  expect(notes()).toHaveValue('Unsaved')
})

test.each([
  ['/clientes/customer-1/orcamentos/novo', '*/clientes/customer-1', customerFixture],
  ['/orcamentos/quote-1/editar', '*/orcamentos/quote-1', quoteFixture],
] as const)('retries a failed initial read for %s without showing an empty form', async (path, endpoint, fixture) => {
  server.use(http.get(endpoint, () => new HttpResponse(null, { status: 500 })))
  mount(path)
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.queryByLabelText('Observações')).not.toBeInTheDocument()
  server.use(http.get(endpoint, () => HttpResponse.json(fixture)))
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  expect(await ready()).toBeVisible()
})
test('allows editing a SENT quote even when expired is true in the server response', async () => {
  server.use(http.get('*/orcamentos/quote-1', () => HttpResponse.json({ ...quoteFixture, status: 'SENT', expired: true })))
  mount('/orcamentos/quote-1/editar'); await ready()
  fireEvent.change(notes(), { target: { value: 'Changed' } })
  expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeEnabled()
})
