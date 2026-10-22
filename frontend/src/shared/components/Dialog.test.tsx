import { StrictMode, useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'
import { Dialog } from './Dialog'
import { Button } from './Button'

// jsdom does not implement the native dialog API or top-layer focus trapping.
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')

beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true } },
    close: { configurable: true, value(this: HTMLDialogElement) {
      this.open = false
      this.dispatchEvent(new Event('close'))
    } },
  })
})

afterAll(() => {
  for (const [name, descriptor] of [['showModal', originalShowModal], ['close', originalClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name)
  }
})

test('opens modally, labels its content and restores focus on close', async () => {
  const user = userEvent.setup()
  function Harness() {
    const [open, setOpen] = useState(false)
    return <><Button onClick={() => setOpen(true)}>Abrir</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Confirmar ação" description="Revise antes de continuar."><Button>Confirmar</Button></Dialog></>
  }
  render(<StrictMode><Harness /></StrictMode>)
  const trigger = screen.getByRole('button', { name: 'Abrir' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await user.click(trigger)
  expect(screen.getByRole('dialog', { name: 'Confirmar ação' })).toHaveAccessibleDescription('Revise antes de continuar.')
  expect(screen.getByRole('heading', { name: 'Confirmar ação' })).toHaveFocus()
  await user.click(screen.getByRole('button', { name: 'Fechar diálogo' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

test('requests closing on the native Escape cancel event', () => {
  const close = vi.fn()
  render(<Dialog open onClose={close} title="Ação">Conteúdo</Dialog>)
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
  expect(close).toHaveBeenCalledOnce()
})

test('restores focus on unmount and tolerates StrictMode effect replay', () => {
  const trigger = document.createElement('button')
  document.body.append(trigger)
  trigger.focus()
  const close = vi.fn()
  const { unmount } = render(<StrictMode><Dialog open onClose={close} title="Ação">Conteúdo</Dialog></StrictMode>)
  expect(screen.getByRole('dialog')).toBeVisible()
  expect(close).not.toHaveBeenCalled()
  unmount()
  expect(trigger).toHaveFocus()
  trigger.remove()
})
