import { Link, useParams } from 'react-router'
import { useCustomer } from '@/features/customers/hooks'
import { ApiError } from '@/shared/api/api-error'
import { ErrorState, LoadingState } from '@/shared/components/States'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { QuoteForm } from './QuoteForm'
import { useQuote, useUpdateQuote } from './hooks'

export function QuoteEditPage() {
  const { quoteId } = useParams()
  const query = useQuote(quoteId)
  const customer = useCustomer(query.data?.customerId)
  const update = useUpdateQuote(quoteId ?? '')
  const missing = query.error instanceof ApiError && query.error.status === 404
  const quote = query.data
  return <div className="space-y-6">
    <Link to={missing ? '/orcamentos' : `/orcamentos/${encodeURIComponent(quoteId ?? '')}`} className="inline-flex min-h-11 items-center text-brand-navy underline">Voltar</Link>
    {query.isPending ? <LoadingState label="Carregando orçamento…" />
      : missing || !quote ? <ErrorState message={missing ? 'Orçamento não encontrado.' : query.error instanceof ApiError ? query.error.message : GENERIC_ERROR_MESSAGE} onRetry={missing ? undefined : () => { void query.refetch() }} />
        : <>
          {query.isError && <ErrorState message={query.error instanceof ApiError ? query.error.message : GENERIC_ERROR_MESSAGE} onRetry={() => { void query.refetch() }} />}
          <section aria-label="Cliente do orçamento" className="space-y-2 rounded-md border border-border-default bg-surface-primary p-4">
            <p className="font-semibold">{quote.quoteNumber}</p>
            {customer.data ? <><p className="break-words">{customer.data.name}</p><p>{customer.data.phone}</p></>
              : <p className="text-text-secondary">{customer.isPending ? 'Carregando cliente…' : 'Cadastro do cliente indisponível.'}</p>}
          </section>
          {quote.status === 'DRAFT' || quote.status === 'SENT'
            ? <QuoteForm key={quote.id} quote={quote} customerAddress={customer.data?.address} onSave={(payload) => update.mutateAsync(payload)} />
            : <p role="status">Este orçamento não permite edição na situação atual.</p>}
        </>}
  </div>
}
