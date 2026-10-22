import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, Link, RouterProvider } from 'react-router'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'
import { QuoteForm } from './QuoteForm'
import { ToastProvider } from '@/shared/components/Toast'
import { quoteFixture } from './fixtures.test-support'
import { customerFixture } from '@/features/customers/fixtures.test-support'

const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')
beforeAll(() => Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true } },
  close: { configurable: true, value(this: HTMLDialogElement) { this.open = false } },
}))
afterAll(() => {
  for (const [name, descriptor] of [['showModal', originalShow], ['close', originalClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name)
  }
})
function mount(onSave = vi.fn(async () => quoteFixture), address = customerFixture.address) {
  const router = createMemoryRouter([
    { path: '/form', element: <><Link to="/other">Sair</Link><QuoteForm quote={quoteFixture} customerAddress={address} onSave={onSave} /></> },
    { path: '/other', element: <p>Outra página</p> },
  ], { initialEntries: ['/other', '/form'] })
  const view = render(<ToastProvider><RouterProvider router={router} /></ToastProvider>)
  return { ...view, router, onSave }
}
const changeNotes = (value: string) => fireEvent.change(screen.getByLabelText('Observações'), { target: { value } })
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))

test('does not save on mount, accepts partial address and resets to server values after saving', async () => {
  const onSave = vi.fn(async () => ({ ...quoteFixture, notes: 'Server normalized', installationAddress: null }))
  mount(onSave)
  expect(onSave).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled()
  changeNotes('Draft')
  fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: '' } })
  fireEvent.change(screen.getByLabelText('Rua'), { target: { value: 'Rua A' } })
  save()
  await screen.findByText('Rascunho salvo.')
  expect(onSave).toHaveBeenCalledWith({ notes: 'Draft', installationAddress: { postalCode: null, street: 'Rua A', number: null, complement: null, neighborhood: null, city: null, state: null } })
  expect(screen.getByLabelText('Observações')).toHaveValue('Server normalized')
  expect(screen.getByLabelText('Rua')).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled()
  fireEvent.click(screen.getByRole('link', { name: 'Sair' }))
  expect(await screen.findByText('Outra página')).toBeVisible()
})
test('copies the customer address as an independent editable snapshot', () => {
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Usar endereço do cliente' }))
  expect(screen.getByLabelText('Rua')).toHaveValue(customerFixture.address!.street)
  fireEvent.change(screen.getByLabelText('Rua'), { target: { value: 'Independent' } })
  expect(customerFixture.address!.street).toBe('Rua de teste')
  expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeEnabled()
})
test('disables address copy when unavailable', () => {
  mount(undefined, null)
  expect(screen.getByRole('button', { name: 'Usar endereço do cliente' })).toBeDisabled()
})
test('validates optional CEP and UF, focuses first error, and preserves values', async () => {
  const { onSave } = mount()
  fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '123' } })
  fireEvent.change(screen.getByLabelText('UF'), { target: { value: 'SPP' } }); save()
  expect(await screen.findByText('Informe um CEP com 8 dígitos.')).toBeVisible()
  expect(screen.getByText('Informe uma UF com 2 letras.')).toBeVisible()
  await waitFor(() => expect(screen.getByLabelText('CEP')).toHaveFocus())
  expect(onSave).not.toHaveBeenCalled()
})
test.each(['link', 'back'])('blocks %s navigation and supports staying or discarding', async (kind) => {
  const { router } = mount(); changeNotes('unsaved')
  async function leave() { if (kind === 'link') fireEvent.click(screen.getByRole('link', { name: 'Sair' })); else await act(async () => { await router.navigate(-1) }) }
  await leave()
  let dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Continuar editando' }))
  expect(screen.getByLabelText('Observações')).toHaveValue('unsaved')
  await leave(); dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Descartar alterações' }))
  expect(await screen.findByText('Outra página')).toBeVisible()
})
test('registers beforeunload only while dirty and removes the listener on unmount', () => {
  const { unmount } = mount()
  const clean = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(clean)
  expect(clean.defaultPrevented).toBe(false)
  changeNotes('unsaved')
  const dirty = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(dirty)
  expect(dirty.defaultPrevented).toBe(true)
  unmount()
  const after = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(after)
  expect(after.defaultPrevented).toBe(false)
})
test('keeps dirty values after a failed save', async () => {
  const onSave = vi.fn(async () => { throw new Error('private diagnostic') })
  mount(onSave); changeNotes('keep'); save()
  expect(await screen.findByRole('alert')).not.toHaveTextContent('private diagnostic')
  expect(screen.getByLabelText('Observações')).toHaveValue('keep')
  expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeEnabled()
})
test('locks fields and duplicate submission while saving', async () => {
  let finish!: (value: typeof quoteFixture) => void
  const onSave = vi.fn(() => new Promise<typeof quoteFixture>((resolve) => { finish = resolve }))
  mount(onSave); changeNotes('save')
  const button = screen.getByRole('button', { name: 'Salvar rascunho' })
  fireEvent.click(button); fireEvent.click(button)
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(screen.getByLabelText('Observações')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled()
  await act(async () => { finish(quoteFixture) })
  expect(await screen.findByText('Rascunho salvo.')).toBeVisible()
})

test('allows an empty new draft and maps blank optional fields to null', async () => {
  const onSave = vi.fn(async () => quoteFixture)
  const router = createMemoryRouter([{ path: '*', element: <QuoteForm onSave={onSave} /> }])
  render(<ToastProvider><RouterProvider router={router} /></ToastProvider>)
  save()
  await screen.findByText('Rascunho salvo.')
  expect(onSave).toHaveBeenCalledWith({})
})
