import { Link } from 'react-router'
import { ApiError } from '@/shared/api/api-error'
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/States'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { formatDate } from '@/shared/format/dates'
import { formatMoney } from '@/shared/format/money'
import { useCustomerQuotes } from './hooks'

export function CustomerQuoteHistory({ customerId }: { customerId: string }) {
  const query = useCustomerQuotes(customerId)
  return <section aria-labelledby="customer-history-title" className="rounded-md border border-border-default bg-surface-primary">
    <h2 id="customer-history-title" className="p-4 text-section-title font-semibold">Histórico de orçamentos</h2>
    {query.isPending ? <LoadingState label="Carregando histórico…" />
      : query.isError ? <ErrorState message={query.error instanceof ApiError ? query.error.message : GENERIC_ERROR_MESSAGE} onRetry={() => { void query.refetch() }} />
        : query.data.length === 0 ? <EmptyState title="Nenhum orçamento para este cliente." />
          : <ul className="divide-y divide-border-default">{query.data.map((quote) => <li key={quote.id}>
            <Link to={`/orcamentos/${encodeURIComponent(quote.id)}`} className="flex min-h-14 min-w-0 flex-col gap-3 p-4 hover:bg-surface-alt sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0 break-words font-semibold text-brand-navy">{quote.quoteNumber}</span>
              <span className="text-label text-text-secondary">{formatDate(quote.createdAt)}</span>
              <StatusBadge status={quote.expired ? 'EXPIRED' : quote.status} />
              <span className="font-semibold tabular-nums">{formatMoney(quote.totalCents)}</span>
            </Link>
          </li>)}</ul>}
  </section>
}
