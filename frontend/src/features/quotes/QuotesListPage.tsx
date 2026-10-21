import { ApiError } from '@/shared/api/api-error'
import { Button } from '@/shared/components/Button'
import { TextField } from '@/shared/components/FormFields'
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/States'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { QuoteRow } from './QuoteRow'
import { StatusFilter } from './StatusFilter'
import { useQuoteFilters } from './use-quote-filters'
import { useQuotes } from './use-quotes'

export function QuotesListPage() {
  const filters = useQuoteFilters()
  const query = useQuotes({ search: filters.search, status: filters.status })
  return <div className="space-y-6">
    <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
      <TextField label="Buscar por cliente ou número" type="search" autoComplete="off" value={filters.value} onChange={(event) => filters.changeSearch(event.target.value)} />
      <StatusFilter value={filters.status} onChange={filters.changeStatus} />
      <Button variant="secondary" disabled={!filters.hasFilters} onClick={filters.clearFilters}>Limpar filtros</Button>
    </div>
    <section aria-label="Resultados de orçamentos" aria-busy={filters.isDebouncing || query.isFetching} className="rounded-md border border-border-default bg-surface-primary">
      {filters.isDebouncing || query.isPending ? <LoadingState label="Buscando orçamentos…" />
        : query.isError ? <ErrorState message={query.error instanceof ApiError ? query.error.message : GENERIC_ERROR_MESSAGE} onRetry={() => { void query.refetch() }} />
          : query.data.length === 0 ? <EmptyState title={filters.hasFilters ? 'Nenhum orçamento encontrado para estes filtros.' : 'Nenhum orçamento cadastrado.'} />
            : <ul className="divide-y divide-border-default">{query.data.map((quote) => <QuoteRow key={quote.id} quote={quote} />)}</ul>}
    </section>
  </div>
}
