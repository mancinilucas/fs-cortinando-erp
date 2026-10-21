import { http, HttpResponse } from 'msw'
import { server } from '@/shared/test/server'
import { render, screen } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import App from '@/app/App'

beforeEach(() => {
  server.use(http.get('*/auth/me', () => new HttpResponse(null, { status: 401 })))
})

test('renders the application heading inside its main landmark', () => {
  render(<App />)

  expect(screen.getByRole('main')).toContainElement(
    screen.getByRole('heading', { level: 1, name: 'Cortinando ERP' }),
  )
})
