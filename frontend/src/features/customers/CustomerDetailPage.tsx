import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '@/shared/api/api-error'
import { Button } from '@/shared/components/Button'
import { ErrorState, LoadingState } from '@/shared/components/States'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { CustomerDeleteDialog } from './CustomerDeleteDialog'
import { CustomerQuoteHistory } from './CustomerQuoteHistory'
import { useCustomer } from './hooks'

export function CustomerDetailPage() {
  const { customerId } = useParams()
  const query = useCustomer(customerId)
  const [deleting, setDeleting] = useState(false)
  const missing = query.error instanceof ApiError && query.error.status === 404
  const customer = query.data
  const base = `/clientes/${encodeURIComponent(customerId ?? '')}`
  return <div className="space-y-6">
    <Link to="/clientes" className="inline-flex min-h-11 items-center text-brand-navy underline">Voltar</Link>
    {query.isPending ? <LoadingState label="Carregando cliente…" />
      : missing || !customer ? <ErrorState message={missing ? 'Cliente não encontrado ou excluído.' : query.error instanceof ApiError ? query.error.message : GENERIC_ERROR_MESSAGE} onRetry={missing ? undefined : () => { void query.refetch() }} />
        : <>
          {query.isError && <ErrorState message={query.error instanceof ApiError ? query.error.message : GENERIC_ERROR_MESSAGE} onRetry={() => { void query.refetch() }} />}
          <section aria-label="Dados cadastrais" className="space-y-4 rounded-md border border-border-default bg-surface-primary p-4 sm:p-6">
            <h2 className="break-words text-section-title font-semibold">{customer.name}</h2>
            <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
              {Object.entries({ Telefone: customer.phone, 'E-mail': customer.email, 'CPF/CNPJ': customer.taxId }).map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-label text-text-secondary">{label}</dt><dd className="break-words">{value || 'Não informado'}</dd></div>)}
              <div className="min-w-0"><dt className="text-label text-text-secondary">Endereço</dt><dd className="break-words">{customer.address ? [customer.address.street, customer.address.number, customer.address.complement, customer.address.neighborhood, customer.address.city, customer.address.state, customer.address.postalCode].filter(Boolean).join(', ') : 'Não informado'}</dd></div>
              <div className="min-w-0 sm:col-span-2"><dt className="text-label text-text-secondary">Observações</dt><dd className="whitespace-pre-wrap break-words">{customer.notes || 'Não informadas'}</dd></div>
            </dl>
          </section>
          <div className="flex flex-wrap items-center gap-3">
            <Link to={`${base}/orcamentos/novo`} className="inline-flex min-h-11 items-center justify-center rounded-sm bg-brand-navy px-4 py-2 text-button font-semibold text-text-inverse hover:brightness-90">Novo orçamento</Link>
            <Link to={`${base}/editar`} className="inline-flex min-h-11 items-center px-3 text-brand-navy underline">Editar cliente</Link>
            <Button variant="destructive" onClick={() => setDeleting(true)}>Excluir cliente</Button>
          </div>
          <CustomerQuoteHistory customerId={customer.id} />
          {deleting && <CustomerDeleteDialog customer={customer} onClose={() => setDeleting(false)} />}
        </>}
  </div>
}
