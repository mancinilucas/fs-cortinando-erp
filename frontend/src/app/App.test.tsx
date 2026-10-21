import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from '@/app/App'

test('renders the application heading inside its main landmark', () => {
  render(<App />)

  expect(screen.getByRole('main')).toContainElement(
    screen.getByRole('heading', { level: 1, name: 'Cortinando ERP' }),
  )
})
