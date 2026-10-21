import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { expect, test, vi } from 'vitest'
import { server } from './server'

test('supports keyboard interaction in jsdom', async () => {
  const user = userEvent.setup()
  const onClick = vi.fn()
  render(<button onClick={onClick}>Continue</button>)

  await user.tab()
  expect(screen.getByRole('button', { name: 'Continue' })).toHaveFocus()
  await user.keyboard('{Enter}')

  expect(onClick).toHaveBeenCalledOnce()
})

test('intercepts fetch requests with a test-local handler', async () => {
  server.use(
    http.get('https://foundation.test/probe', () =>
      HttpResponse.json({ ready: true }),
    ),
  )

  const response = await fetch('https://foundation.test/probe')

  expect(response.status).toBe(200)
  await expect(response.json()).resolves.toEqual({ ready: true })
})

test('starts with a clean DOM and no handlers from previous tests', () => {
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(server.listHandlers()).toHaveLength(0)
})

test('rejects requests without a handler instead of reaching the network', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})

  await expect(fetch('https://foundation.test/unhandled')).rejects.toThrow()

  expect(error).toHaveBeenCalled()
})
