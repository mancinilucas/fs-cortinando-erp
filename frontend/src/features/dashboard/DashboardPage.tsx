import { ApiError } from '@/shared/api/api-error'
import { ErrorState } from '@/shared/components/States'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { InstallationList } from './InstallationList'
import { StatusCountCard } from './StatusCountCard'
import { useDashboard } from './use-dashboard'

const cards = [
  { key: 'draft', label: 'Rascunhos', status: 'DRAFT' },
  { key: 'sent', label: 'Enviados', status: 'SENT' },
  { key: 'expired', label: 'Expirados', status: 'EXPIRED' },
  { key: 'confirmed', label: 'Confirmados', status: 'CONFIRMED' },
  { key: 'inProduction', label: 'Em produção', status: 'IN_PRODUCTION' },
] as const
const cardGrid = 'grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5'

function DashboardSkeleton() {
  return <div role="status" aria-label="Carregando dashboard" className="space-y-6">
    <span className="sr-only">Carregando dashboard…</span>
    <div aria-hidden="true" className={cardGrid}>
      {cards.map(({ key }) => <div key={key} className="min-h-28 rounded-md border border-border-default bg-surface-primary p-4">
        <div className="mb-4 h-4 w-20 bg-surface-alt" /><div className="h-8 w-12 bg-surface-alt" />
      </div>)}
    </div>
    <div aria-hidden="true" className="grid gap-6 xl:grid-cols-2">
      {[0, 1, 2].map((index) => <div key={index} className="h-48 rounded-md border border-border-default bg-surface-primary p-4">
        <div className="mb-6 h-5 w-40 bg-surface-alt" /><div className="h-20 bg-surface-alt" />
      </div>)}
    </div>
  </div>
}

export function DashboardPage() {
  const query = useDashboard()
  if (query.isPending) return <DashboardSkeleton />
  if (query.isError) return <ErrorState message={query.error instanceof ApiError ? query.error.message : GENERIC_ERROR_MESSAGE}
    onRetry={() => { void query.refetch() }} />
  const { statusCounts, upcomingInstallations, weeklyInstallations, overdueInstallations } = query.data
  return <div className="space-y-6">
    <section aria-label="Situação dos orçamentos" className={cardGrid}>
      {cards.map(({ key, label, status }) => <StatusCountCard key={key} label={label} status={status} count={statusCounts[key]} />)}
    </section>
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <InstallationList title="Próximas instalações" items={upcomingInstallations} emptyMessage="Nenhuma próxima instalação." />
      <InstallationList title="Instalações da semana" items={weeklyInstallations} emptyMessage="Nenhuma instalação nesta semana." />
      <div className="min-w-0 xl:col-span-2">
        <InstallationList title="Instalações atrasadas" items={overdueInstallations} emptyMessage="Nenhuma instalação atrasada." overdue />
      </div>
    </div>
  </div>
}
