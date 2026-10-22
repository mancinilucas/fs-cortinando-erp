import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { Button } from './Button'
import { ToastProvider } from './Toast'
import { useToast } from './toast-context'

function Harness() {
  const toast = useToast()
  return <><Button onClick={() => toast.success('Salvo.')}>Sucesso</Button>
    <Button onClick={() => toast.error('Falha.')}>Erro</Button>
    <Button onClick={() => { toast.error('Falha.'); toast.error('Falha.') }}>Erro duplicado</Button>
    {[1, 2, 3, 4].map((number) => <Button key={number} onClick={() => toast.success(`Sucesso ${number}.`)}>Sucesso {number}</Button>)}</>
}

test('announces semantic feedback, deduplicates repeated messages and lets the user dismiss persistent errors', () => {
  render(<ToastProvider><Harness /></ToastProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Erro duplicado' }))
  expect(screen.getAllByRole('alert')).toHaveLength(1)
  expect(screen.getByRole('alert')).toHaveTextContent('Falha.')
  fireEvent.click(screen.getByRole('button', { name: 'Fechar notificação' }))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Sucesso' }))
  expect(screen.getByRole('status')).toHaveTextContent('Salvo.')
})

test('keeps at most three toasts and dismisses success after five seconds', () => {
  vi.useFakeTimers()
  render(<ToastProvider><Harness /></ToastProvider>)
  for (const number of [1, 2, 3, 4]) fireEvent.click(screen.getByRole('button', { name: `Sucesso ${number}` }))
  expect(screen.getAllByRole('status')).toHaveLength(3)
  expect(screen.getAllByText(/Sucesso [234]\./)).toHaveLength(3)
  act(() => { vi.advanceTimersByTime(5000) })
  expect(screen.queryByText(/Sucesso [234]\./)).not.toBeInTheDocument()
  vi.useRealTimers()
})
