import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, test, vi } from 'vitest'
import { createAppQueryClient } from '@/app/query-client'
import { server } from '@/shared/test/server'
import { BusinessDataPage } from './BusinessDataPage'
import { ToastProvider } from '@/shared/components/Toast'
import { businessDataQueryKey } from './hooks'

const saved = { commercialNameOrConsultant: 'Cortinando', phone: '11999999999', email: null, taxId: null, updatedAt: '2026-10-21T13:00:00.000Z' }
function mount() {
  const client = createAppQueryClient()
  const view = render(<ToastProvider><QueryClientProvider client={client}><BusinessDataPage /></QueryClientProvider></ToastProvider>)
  return { ...view, client }
}

test('404 opens blank form, requires name and phone, then saves full replacement and adopts server response', async () => {
  let configured = false
  const put = vi.fn(async ({ request }: { request: Request }) => {
    const body = await request.json()
    expect(body).toEqual({ commercialNameOrConsultant: 'Cortinando', phone: '11999999999', email: null, taxId: null })
    configured = true
    return HttpResponse.json(saved)
  })
  server.use(http.get('*/dados-do-negocio', () => configured ? HttpResponse.json(saved) : new HttpResponse(null, { status: 404 })), http.put('*/dados-do-negocio', put))
  const view = mount()
  expect(await screen.findByText(/ainda não foram configurados/)).toBeVisible()
  expect(screen.getByLabelText('Nome comercial ou da consultora (obrigatório)')).toHaveValue('')
  fireEvent.change(screen.getByLabelText('Nome comercial ou da consultora (obrigatório)'), { target: { value: ' ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar dados' }))
  expect(await screen.findByText('Informe o nome comercial ou da consultora.')).toBeVisible()
  fireEvent.change(screen.getByLabelText('Nome comercial ou da consultora (obrigatório)'), { target: { value: 'Cortinando' } })
  fireEvent.change(screen.getByLabelText('Telefone (obrigatório)'), { target: { value: '11999999999' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar dados' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Dados do negócio salvos.')
  expect(put).toHaveBeenCalledOnce()
  expect(view.client.getQueryData(businessDataQueryKey)).toEqual(saved)
  expect(screen.getByText(/Última atualização/)).toBeVisible()
  view.unmount(); view.client.clear()
})

test('shows load failure with manual retry', async () => {
  const get = vi.fn(() => new HttpResponse(null, { status: 500 }))
  server.use(http.get('*/dados-do-negocio', get))
  const view = mount()
  expect(await screen.findByRole('alert')).toBeVisible()
  server.use(http.get('*/dados-do-negocio', () => HttpResponse.json(saved)))
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await waitFor(() => expect(screen.getByLabelText('Nome comercial ou da consultora (obrigatório)')).toHaveValue(saved.commercialNameOrConsultant))
  view.unmount(); view.client.clear()
})

test('shows save errors without treating the form as saved', async () => {
  server.use(http.get('*/dados-do-negocio', () => HttpResponse.json(saved)), http.put('*/dados-do-negocio', () => HttpResponse.json({ message: 'private diagnostic' }, { status: 500 })))
  const view = mount()
  await screen.findByDisplayValue(saved.commercialNameOrConsultant)
  fireEvent.change(screen.getByLabelText('Telefone (obrigatório)'), { target: { value: '5511' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar dados' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir a operação. Tente novamente.')
  expect(screen.queryByText('Dados do negócio salvos.')).not.toBeInTheDocument()
  view.unmount(); view.client.clear()
})

test('locks repeat save attempts while the full replacement is pending', async () => {
  let finish!: () => void
  const held = new Promise<void>((resolve) => { finish = resolve })
  const put = vi.fn(async () => { await held; return HttpResponse.json(saved) })
  server.use(http.get('*/dados-do-negocio', () => HttpResponse.json(saved)), http.put('*/dados-do-negocio', put))
  const view = mount()
  await screen.findByDisplayValue(saved.commercialNameOrConsultant)
  fireEvent.change(screen.getByLabelText('Telefone (obrigatório)'), { target: { value: '5511' } })
  const button = screen.getByRole('button', { name: 'Salvar dados' })
  fireEvent.click(button)
  const pending = await screen.findByRole('button', { name: 'Salvando…' })
  expect(pending).toBeDisabled()
  fireEvent.click(pending)
  await waitFor(() => expect(put).toHaveBeenCalledOnce())
  finish()
  expect(await screen.findByRole('status')).toHaveTextContent('Dados do negócio salvos.')
  view.unmount(); view.client.clear()
})
