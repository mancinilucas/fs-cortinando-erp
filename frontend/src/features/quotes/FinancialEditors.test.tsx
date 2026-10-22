import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test, vi } from 'vitest'
import { QuoteForm } from './QuoteForm'
import { ToastProvider } from '@/shared/components/Toast'
import type { QuoteFormPayload } from './quote-form'
import { quoteFixture } from './fixtures.test-support'
import type { QuoteDetail } from './types'

function mount(quote: QuoteDetail | undefined = quoteFixture, onSave = vi.fn<(payload: QuoteFormPayload) => Promise<QuoteDetail>>(async () => quoteFixture)) {
  const router = createMemoryRouter([{ path: '*', element: <QuoteForm quote={quote} onSave={onSave} /> }])
  render(<ToastProvider><RouterProvider router={router} /></ToastProvider>)
  return onSave
}
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
const mode = (value: string) => fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de desconto' }), { target: { value } })
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const addOns = () => screen.getAllByRole('group', { name: /^Adicional geral \d+$/ })

test('starts add-ons empty and enables only the chosen discount field', () => {
  mount()
  expect(screen.getByText('Nenhum adicional geral adicionado.')).toBeVisible()
  expect(screen.getByLabelText('Desconto percentual (%)')).toBeDisabled()
  expect(screen.getByLabelText('Desconto em valor fixo (R$)')).toBeDisabled()
  mode('PERCENTAGE')
  expect(screen.getByLabelText('Desconto percentual (%)')).toBeEnabled()
  expect(screen.getByLabelText('Desconto em valor fixo (R$)')).toBeDisabled()
  mode('FIXED_AMOUNT')
  expect(screen.getByLabelText('Desconto percentual (%)')).toBeDisabled()
  expect(screen.getByLabelText('Desconto em valor fixo (R$)')).toBeEnabled()
})
test('adds add-ons with exact quantities and prices, preserving order and ids', async () => {
  const onSave = mount({ ...quoteFixture, generalAddOns: [{ id: 'persisted', name: 'Frete', quantity: 1, unit: 'un', unitPriceCents: 100, totalCents: 999 }] })
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar adicional geral' }))
  const added = addOns()[1]
  fireEvent.change(within(added).getByLabelText('Nome do adicional (obrigatório)'), { target: { value: 'Instalação' } })
  fireEvent.change(within(added).getByLabelText('Quantidade do adicional'), { target: { value: '1,123456' } })
  fireEvent.change(within(added).getByLabelText('Preço unitário do adicional (R$)'), { target: { value: '0,29' } })
  fireEvent.click(within(added).getByRole('button', { name: 'Subir adicional' }))
  expect(within(addOns()[0]).getByLabelText('Nome do adicional (obrigatório)')).toHaveValue('Instalação')
  save(); await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(onSave.mock.calls[0][0].generalAddOns).toEqual([
    { name: 'Instalação', quantity: 1.123456, unit: null, unitPriceCents: 29 },
    { id: 'persisted', name: 'Frete', quantity: 1, unit: 'un', unitPriceCents: 100 },
  ])
})
test('removing all add-ons sends an empty collection', async () => {
  const onSave = mount({ ...quoteFixture, generalAddOns: [{ id: 'a', name: 'Frete', quantity: null, unit: null, unitPriceCents: null, totalCents: null }] })
  fireEvent.click(screen.getByRole('button', { name: 'Remover adicional' })); save()
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(onSave.mock.calls[0][0].generalAddOns).toEqual([])
})
test('validates the additional name on submit and focuses it', async () => {
  const onSave = mount()
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar adicional geral' })); save()
  expect(await screen.findByText('Informe o nome do adicional.')).toBeVisible()
  await waitFor(() => expect(screen.getByLabelText('Nome do adicional (obrigatório)')).toHaveFocus())
  expect(onSave).not.toHaveBeenCalled()
})
test.each([['PERCENTAGE', 'Desconto percentual (%)', '12,34', { type: 'PERCENTAGE', percentage: 12.34, fixedAmountCents: null }],
  ['FIXED_AMOUNT', 'Desconto em valor fixo (R$)', '0,29', { type: 'FIXED_AMOUNT', percentage: null, fixedAmountCents: 29 }]] as const)('saves %s and signed commercial adjustment without computing totals', async (type, label, value, discount) => {
  const onSave = mount()
  mode(type); fill(label, value); fill('Ajuste comercial (R$)', '-0,01'); save()
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(onSave.mock.calls[0][0]).toMatchObject({ discount, commercialAdjustmentCents: -1 })
  expect(onSave.mock.calls[0][0]).not.toHaveProperty('totals')
})
test('requires a positive active discount and ignores the invalid text after disabling the mode', async () => {
  const onSave = mount()
  mode('PERCENTAGE'); fill('Desconto percentual (%)', '101'); save()
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(onSave).not.toHaveBeenCalled()
  mode('NO_DISCOUNT'); fill('Ajuste comercial (R$)', '+1,13'); save()
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(onSave.mock.calls[0][0]).not.toHaveProperty('discount')
  expect(onSave.mock.calls[0][0]).toHaveProperty('commercialAdjustmentCents', 113)
})
test('totals remain confirmed while editing and change only to the save response', async () => {
  let finish!: (value: QuoteDetail) => void
  const onSave = vi.fn<(payload: QuoteFormPayload) => Promise<QuoteDetail>>(() => new Promise((resolve) => { finish = resolve }))
  const saved = { ...quoteFixture, commercialAdjustmentCents: -1, totals: { ...quoteFixture.totals, totalCents: 123456, discountValueCents: 2468 } }
  mount(quoteFixture, onSave)
  const summary = screen.getByRole('region', { name: 'Totais salvos' })
  expect(within(summary).getAllByText(/9,87/).length).toBeGreaterThan(0)
  mode('FIXED_AMOUNT'); fill('Desconto em valor fixo (R$)', '100'); fill('Ajuste comercial (R$)', '-0,01')
  expect(within(summary).queryByText(/1\.234,56/)).not.toBeInTheDocument()
  save(); await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(screen.getByLabelText('Ajuste comercial (R$)')).toBeDisabled()
  await act(async () => { finish(saved) })
  expect(within(summary).getByText(/1\.234,56/)).toBeVisible()
  expect(within(summary).getByText(/24,68/)).toBeVisible()
  expect(screen.getByLabelText('Ajuste comercial (R$)')).toHaveValue('-0,01')
  expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled()
})
test('new quotes have no financial preview before saving', () => {
  const router = createMemoryRouter([{ path: '*', element: <QuoteForm onSave={vi.fn()} /> }])
  render(<ToastProvider><RouterProvider router={router} /></ToastProvider>)
  expect(screen.getByText('Os totais serão exibidos após salvar o rascunho.')).toBeVisible()
  expect(screen.queryByLabelText(/total desejado/i)).not.toBeInTheDocument()
})
test('keeps financial inputs and confirmed totals on save failure', async () => {
  const onSave = vi.fn<(payload: QuoteFormPayload) => Promise<QuoteDetail>>(async () => { throw new Error('private diagnostic') })
  mount(quoteFixture, onSave)
  fill('Ajuste comercial (R$)', '-0,01'); save()
  expect(await screen.findByRole('alert')).not.toHaveTextContent('private diagnostic')
  expect(screen.getByLabelText('Ajuste comercial (R$)')).toHaveValue('-0,01')
  expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeEnabled()
})
