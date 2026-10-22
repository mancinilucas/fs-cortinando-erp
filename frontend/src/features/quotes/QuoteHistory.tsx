import { ApiError } from '@/shared/api/api-error'
import { EmptyState, ErrorState, LoadingListState } from '@/shared/components/States'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { formatDateTime } from '@/shared/format/dates'
import { historyEventLabels } from '@/shared/format/labels'
import { historyDetailLines } from './history-details'
import { useQuoteHistory } from './hooks'

export function QuoteHistory({ quoteId }: { quoteId: string }) {
  const query = useQuoteHistory(quoteId)
  return <section aria-labelledby="quote-history-title" className="rounded-md border border-border-default bg-surface-primary">
    <h2 id="quote-history-title" className="p-4 text-section-title font-semibold">Histórico do orçamento</h2>
    {query.isPending ? <LoadingListState label="Carregando histórico…" />
      : query.isError ? <ErrorState message={query.error instanceof ApiError ? query.error.message : GENERIC_ERROR_MESSAGE} onRetry={() => { void query.refetch() }} />
        : query.data.length === 0 ? <EmptyState title="Nenhum evento registrado." />
          : <ol className="divide-y divide-border-default">{query.data.map((entry) => <li key={entry.id} className="space-y-2 p-4">
            <p className="font-semibold">{historyEventLabels[entry.eventType]}</p>
            <time dateTime={entry.occurredAt} className="text-label text-text-secondary">{formatDateTime(entry.occurredAt)}</time>
            {historyDetailLines(entry).map((line, index) => <p key={index} className="whitespace-pre-wrap break-words text-label">{line}</p>)}
          </li>)}</ol>}
  </section>
}
