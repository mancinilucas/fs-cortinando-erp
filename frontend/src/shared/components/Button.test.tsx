import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { Button, IconButton } from './Button'

test('is keyboard accessible and does not submit a form by default', async () => {
  const user = userEvent.setup()
  const onClick = vi.fn()
  const onSubmit = vi.fn((event) => event.preventDefault())
  render(<form onSubmit={onSubmit}><Button onClick={onClick}>Salvar</Button></form>)
  await user.tab()
  expect(screen.getByRole('button', { name: 'Salvar' })).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(onClick).toHaveBeenCalledOnce()
  expect(onSubmit).not.toHaveBeenCalled()
})

test('preserves submit semantics, refs and disabled behavior', async () => {
  const user = userEvent.setup()
  const onClick = vi.fn()
  const ref = createRef<HTMLButtonElement>()
  const { rerender } = render(<Button ref={ref} type="submit" disabled onClick={onClick}>Salvar</Button>)
  expect(ref.current).toBe(screen.getByRole('button'))
  expect(ref.current).toHaveAttribute('type', 'submit')
  await user.click(screen.getByRole('button'))
  expect(onClick).not.toHaveBeenCalled()
  rerender(<Button onClick={onClick}>Salvar</Button>)
  await user.click(screen.getByRole('button'))
  expect(onClick).toHaveBeenCalledOnce()
})

test('requires a visible-purpose accessible name for icon actions', async () => {
  const onClick = vi.fn()
  render(<IconButton label="Excluir item" icon={<svg data-testid="icon" />} onClick={onClick} />)
  await userEvent.setup().click(screen.getByRole('button', { name: 'Excluir item' }))
  expect(onClick).toHaveBeenCalledOnce()
  expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true')
})
