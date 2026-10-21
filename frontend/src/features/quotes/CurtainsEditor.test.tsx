import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test, vi } from 'vitest'
import type { QuoteFormPayload } from './quote-form'
import { QuoteForm } from './QuoteForm'
import { quoteFixture } from './fixtures.test-support'
import type { QuoteDetail } from './types'

function mount(quote: QuoteDetail | undefined = quoteFixture, onSave = vi.fn<(payload: QuoteFormPayload) => Promise<QuoteDetail>>(async () => quoteFixture)) {
  const router = createMemoryRouter([{ path: '*', element: <QuoteForm quote={quote} onSave={onSave} /> }])
  render(<RouterProvider router={router} />)
  return onSave
}
const curtains = () => screen.getAllByRole('group', { name: /^Cortina \d+$/ })
const components = (curtain: HTMLElement) => within(curtain).queryAllByRole('group', { name: /^Componente \d+$/ })
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))

test('renders all editable fields and server-derived values without recalculating them', () => {
  mount()
  const curtain = curtains()[0]
  expect(within(curtain).getByLabelText('Largura do vão (m)')).toHaveValue('2,123')
  expect(within(curtain).getByText('Largura final salva: 7,321 m')).toBeVisible()
  fireEvent.change(within(curtain).getByLabelText('Largura do vão (m)'), { target: { value: '10' } })
  expect(within(curtain).getByText('Largura final salva: 7,321 m')).toBeVisible()
  expect(within(curtain).getByText('Quantidade de tecido salva: 8,765 m')).toBeVisible()
  for (const label of ['Ambiente', 'Descrição', 'Material', 'Borda (m)', 'Altura (m)', 'Fator de tecido', 'Observações da cortina']) expect(within(curtain).getByLabelText(label)).toBeVisible()
})
test('adds and removes curtains and sends an empty array after removing the last persisted one', async () => {
  const onSave = mount()
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar cortina' }))
  expect(curtains()).toHaveLength(2)
  fireEvent.click(within(curtains()[1]).getByRole('button', { name: 'Remover cortina' }))
  fireEvent.click(within(curtains()[0]).getByRole('button', { name: 'Remover cortina' }))
  expect(screen.getByText('Nenhuma cortina adicionada.')).toBeVisible()
  save(); await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(onSave.mock.calls[0][0]).toMatchObject({ curtains: [] })
})
test('reorders curtains without mixing child values or persisted identities', async () => {
  const second = { ...quoteFixture.curtains[0], id: 'curtain-2', room: 'Quarto', components: [{ ...quoteFixture.curtains[0].components[0], id: 'component-2', name: 'Trilho' }] }
  const onSave = mount({ ...quoteFixture, curtains: [...quoteFixture.curtains, second] })
  fireEvent.change(within(curtains()[0]).getByLabelText('Ambiente'), { target: { value: 'Sala editada' } })
  fireEvent.click(within(curtains()[1]).getByRole('button', { name: 'Subir cortina' }))
  expect(within(curtains()[0]).getByLabelText('Ambiente')).toHaveValue('Quarto')
  expect(within(components(curtains()[0])[0]).getByLabelText('Nome do componente (obrigatório)')).toHaveValue('Trilho')
  fireEvent.change(within(components(curtains()[0])[0]).getByLabelText('Nome do componente (obrigatório)'), { target: { value: 'Trilho editado' } })
  save(); await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  const payload = onSave.mock.calls[0][0]
  expect(payload.curtains?.map((curtain) => curtain.id)).toEqual(['curtain-2', 'curtain-1'])
  expect(payload.curtains?.[0].components?.[0]).toMatchObject({ id: 'component-2', name: 'Trilho editado' })
  expect(payload.curtains?.[1]).toMatchObject({ room: 'Sala editada', components: [{ id: 'component-1', name: 'Tecido' }] })
})
test('adds, reorders and removes components while retaining ids and exact quantities/prices', async () => {
  const onSave = mount()
  const curtain = curtains()[0]
  fireEvent.click(within(curtain).getByRole('button', { name: 'Adicionar componente' }))
  let fresh = components(curtain)[1]
  fireEvent.change(within(fresh).getByLabelText('Nome do componente (obrigatório)'), { target: { value: 'Frete da cortina' } })
  fireEvent.change(within(fresh).getByLabelText('Quantidade'), { target: { value: '1,123456' } })
  fireEvent.change(within(fresh).getByLabelText('Preço unitário (R$)'), { target: { value: '0,29' } })
  fireEvent.click(within(fresh).getByRole('button', { name: 'Subir componente' }))
  fresh = components(curtain)[0]
  expect(within(fresh).getByLabelText('Nome do componente (obrigatório)')).toHaveValue('Frete da cortina')
  save(); await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(onSave.mock.calls[0][0].curtains?.[0].components).toEqual([
    { name: 'Frete da cortina', quantity: 1.123456, unit: null, unitPriceCents: 29 },
    { id: 'component-1', name: 'Tecido', quantity: 1.123456, unit: null, unitPriceCents: 100 },
  ])
})
test('preset copies only server quantity even after local measures change and remains editable', async () => {
  const onSave = mount(); const curtain = curtains()[0]
  fireEvent.change(within(curtain).getByLabelText('Largura do vão (m)'), { target: { value: '999' } })
  fireEvent.click(within(curtain).getByRole('button', { name: 'Adicionar mão de obra' }))
  const preset = components(curtain)[1]
  expect(within(preset).getByLabelText('Quantidade')).toHaveValue('8,765')
  expect(within(preset).getByLabelText('Unidade')).toHaveValue('m')
  expect(within(preset).getByLabelText('Preço unitário (R$)')).toHaveValue('30,00')
  fireEvent.change(within(preset).getByLabelText('Quantidade'), { target: { value: '2' } })
  save(); await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(onSave.mock.calls[0][0].curtains?.[0].components?.[1]).toEqual({ name: 'Mão de obra', quantity: 2, unit: 'm', unitPriceCents: 3000 })
})
test('disables the preset for new curtains and curtains without server quantity', () => {
  mount({ ...quoteFixture, curtains: [{ ...quoteFixture.curtains[0], fabricQuantity: null }] })
  expect(screen.getByRole('button', { name: 'Adicionar mão de obra' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar cortina' }))
  expect(screen.getAllByRole('button', { name: 'Adicionar mão de obra' }).every((button) => button.hasAttribute('disabled'))).toBe(true)
  expect(screen.getAllByText(/Salve a cortina com as medidas/)).toHaveLength(2)
})
test('validates nested fields on submission and focuses the first invalid input', async () => {
  const onSave = mount(); const curtain = curtains()[0]
  fireEvent.change(within(curtain).getByLabelText('Largura do vão (m)'), { target: { value: '1,2345' } })
  fireEvent.click(within(curtain).getByRole('button', { name: 'Adicionar componente' }))
  save()
  expect(await screen.findByText('Informe o nome do componente.')).toBeVisible()
  expect(within(curtain).getByLabelText('Largura do vão (m)')).toHaveAttribute('aria-invalid', 'true')
  await waitFor(() => expect(within(curtain).getByLabelText('Largura do vão (m)')).toHaveFocus())
  expect(onSave).not.toHaveBeenCalled()
})
test('server response refreshes identities and preset basis after save', async () => {
  const saved = { ...quoteFixture, curtains: [{ ...quoteFixture.curtains[0], id: 'assigned', fabricQuantity: 42, components: [] }] }
  const onSave = vi.fn<(payload: QuoteFormPayload) => Promise<QuoteDetail>>(async () => saved)
  mount({ ...quoteFixture, curtains: [] }, onSave)
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar cortina' }))
  save(); await screen.findByText('Rascunho salvo.')
  const curtain = curtains()[0]
  expect(within(curtain).getByText('Quantidade de tecido salva: 42 m')).toBeVisible()
  fireEvent.click(within(curtain).getByRole('button', { name: 'Adicionar mão de obra' }))
  expect(within(components(curtain)[0]).getByLabelText('Quantidade')).toHaveValue('42')
  save(); await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
  expect(onSave.mock.calls[1][0].curtains?.[0].id).toBe('assigned')
})
test('removing all components explicitly clears the collection and blocks editing during save', async () => {
  let finish!: (value: QuoteDetail) => void
  const onSave = vi.fn<(payload: QuoteFormPayload) => Promise<QuoteDetail>>(() => new Promise<QuoteDetail>((resolve) => { finish = resolve }))
  mount(quoteFixture, onSave)
  fireEvent.click(within(components(curtains()[0])[0]).getByRole('button', { name: 'Remover componente' }))
  save(); await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(onSave.mock.calls[0][0].curtains?.[0].components).toEqual([])
  expect(screen.getByRole('button', { name: 'Adicionar cortina' })).toBeDisabled()
  await act(async () => { finish(quoteFixture) })
})
