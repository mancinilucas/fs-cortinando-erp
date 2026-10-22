import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { LoadingListState, LoadingState, EmptyState, ErrorState } from './States'
import { StatusBadge } from './StatusBadge'
import { quoteStatusLabels } from '@/shared/format/labels'
import type { QuoteDisplayStatus } from '@/shared/format/labels'
import { Surface } from './Surface'

const statuses: QuoteDisplayStatus[] = ['DRAFT', 'SENT', 'EXPIRED', 'CONFIRMED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED']

test.each(statuses)('shows the label for %s with a decorative icon', (status) => {
  const label = quoteStatusLabels[status]
  render(<StatusBadge status={status} />)
  expect(screen.getByText(label)).toBeInTheDocument()
  expect(screen.getByText(label).querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
})

test('announces loading once and hides the decorative spinner', () => {
  render(<LoadingState label="Carregando dados…" />)
  expect(screen.getByRole('status')).toHaveTextContent('Carregando dados…')
  expect(screen.getByRole('status').querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
})

test('renders an accessible list skeleton with a useful loading label', () => {
  render(<LoadingListState label="Buscando clientes…" rows={4} />)
  expect(screen.getByRole('status', { name: 'Buscando clientes…' })).toBeInTheDocument()
  expect(screen.getByRole('status').querySelectorAll('li')).toHaveLength(4)
  expect(screen.getByRole('status').querySelector('ul')).toHaveAttribute('aria-hidden', 'true')
})

test('shows empty-state instructions without treating absence as an error', () => {
  render(<Surface><EmptyState title="Nenhum resultado">Ajuste a busca.</EmptyState></Surface>)
  expect(screen.getByText('Nenhum resultado')).toBeVisible()
  expect(screen.getByText('Ajuste a busca.')).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('only retries when requested by the user', async () => {
  const retry = vi.fn()
  render(<ErrorState message="Não foi possível carregar." onRetry={retry} />)
  expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar.')
  expect(retry).not.toHaveBeenCalled()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }))
  expect(retry).toHaveBeenCalledOnce()
})
