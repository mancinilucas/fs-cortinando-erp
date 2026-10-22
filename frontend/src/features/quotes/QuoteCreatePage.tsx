import { useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useCustomer } from '@/features/customers/hooks'
import { ApiError } from '@/shared/api/api-error'
import { ErrorState, LoadingState } from '@/shared/components/States'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { QuoteForm } from './QuoteForm'
import { useCreateQuote } from './hooks'
import { createQuoteSchema } from './schema'
import type { QuoteDetail } from './types'

export function QuoteCreatePage() {
  const { customerId } = useParams()
  const query = useCustomer(customerId)
  const create = useCreateQuote(customerId ?? '')
  const navigate = useNavigate()
  const onSaved = useCallback((saved: QuoteDetail) => { void navigate(`/orcamentos/${encodeURIComponent(saved.id)}/editar`, { replace: true }) }, [navigate])
  const missing = query.error instanceof ApiError && query.error.status === 404
  return <div className="space-y-6">
    <Link to={missing ? '/clientes' : `/clientes/${encodeURIComponent(customerId ?? '')}`} className="inline-flex min-h-11 items-center text-brand-navy underline">Voltar</Link>
    {query.isPending ? <LoadingState label="Carregando cliente…" />
      : missing || !query.data ? <ErrorState message={missing ? 'Cliente não encontrado ou excluído.' : query.error instanceof ApiError ? query.error.message : GENERIC_ERROR_MESSAGE} onRetry={missing ? undefined : () => { void query.refetch() }} />
        : <>
          {query.isError && <ErrorState message={query.error instanceof ApiError ? query.error.message : GENERIC_ERROR_MESSAGE} onRetry={() => { void query.refetch() }} />}
          <section aria-label="Cliente do orçamento" className="space-y-2 rounded-md border border-border-default bg-surface-primary p-4">
            <p className="break-words font-semibold">{query.data.name}</p><p>{query.data.phone}</p>
          </section>
          <QuoteForm key={customerId} customerAddress={query.data.address} onSave={(payload) => create.mutateAsync(createQuoteSchema.parse(payload))} onSaved={onSaved} />
        </>}
  </div>
}
