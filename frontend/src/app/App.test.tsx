import { http, HttpResponse } from 'msw'
import { server } from '@/shared/test/server'
import { render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import App from '@/app/App'

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  server.use(http.get('*/auth/me', () => new HttpResponse(null, { status: 401 })))
})

test('redirects an anonymous application entry to the public login', async () => {
  render(<App />)

  expect(await screen.findByLabelText('Senha')).toBeVisible()
  expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { name: 'Entrar' }))
})
