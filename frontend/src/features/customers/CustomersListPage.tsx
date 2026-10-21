import { Link } from 'react-router'
import { ApiError } from '@/shared/api/api-error'
import { TextField } from '@/shared/components/FormFields'
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/States'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { useCustomers } from './hooks'
import { useCustomerSearch } from './use-customer-search'

export function CustomersListPage() {
  const { search, value, changeSearch, isDebouncing } = useCustomerSearch()
  const query = useCustomers(search)
  return <div className="space-y-6">
    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="w-full min-w-0 sm:max-w-110">
        <TextField label="Buscar por nome" type="search" value={value} onChange={(event) => changeSearch(event.target.value)} autoComplete="off" />
      </div>
      <Link to="/clientes/novo" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-sm bg-brand-navy px-4 py-2 text-button font-semibold text-text-inverse hover:brightness-90">Novo cliente</Link>
    </div>
    <section aria-label="Resultados de clientes" aria-busy={isDebouncing || query.isFetching}
      className="rounded-md border border-border-default bg-surface-primary">
      {isDebouncing || query.isPending ? <LoadingState label="Buscando clientes…" />
        : query.isError ? <ErrorState message={query.error instanceof ApiError ? query.error.message : GENERIC_ERROR_MESSAGE}
          onRetry={() => { void query.refetch() }} />
          : query.data.length === 0 ? <EmptyState title={search ? 'Nenhum cliente encontrado para esta busca.' : 'Nenhum cliente cadastrado.'} />
            : <ul className="divide-y divide-border-default">
              {query.data.map((customer) => <li key={customer.id}>
                <Link to={`/clientes/${encodeURIComponent(customer.id)}`} className="flex min-h-14 min-w-0 flex-col gap-2 p-4 hover:bg-surface-alt sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0 break-words font-medium text-brand-navy">{customer.name}</span>
                  <span className="min-w-0 break-words text-label text-text-secondary">
                    <span className="block">{customer.phone}</span>
                    {customer.email && <span className="block">{customer.email}</span>}
                  </span>
                </Link>
              </li>)}
            </ul>}
    </section>
  </div>
}
