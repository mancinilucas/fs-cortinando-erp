import { useId } from 'react'
import { ClockAlert } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/shared/components/States'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { formatDateTime } from '@/shared/format/dates'
import type { DashboardInstallation } from './types'

export function InstallationList({ title, items, emptyMessage, overdue = false }: {
  title: string
  items: DashboardInstallation[]
  emptyMessage: string
  overdue?: boolean
}) {
  const headingId = useId()
  return <section aria-labelledby={headingId} className="min-w-0 rounded-md border border-border-default bg-surface-primary">
    <h2 id={headingId} className="border-b border-border-default p-4 text-section-title font-semibold">{title}</h2>
    {items.length === 0 ? <EmptyState title={emptyMessage} /> : <ul className="divide-y divide-border-default">
      {items.map((item) => <li key={item.quoteId}>
        <Link to={`/orcamentos/${encodeURIComponent(item.quoteId)}`} className="flex min-h-11 min-w-0 flex-col gap-3 p-4 hover:bg-surface-alt">
          <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:justify-between">
            <div className="w-full min-w-0 flex-1 break-words sm:w-auto">
              <p className="font-medium text-brand-navy">{item.customerName}</p>
              <p className="text-caption text-text-secondary">{item.quoteNumber}</p>
            </div>
            <StatusBadge status={item.status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-label text-text-secondary">
            <time dateTime={item.scheduledInstallationAt}>{formatDateTime(item.scheduledInstallationAt)}</time>
            {overdue && <span className="inline-flex items-center gap-1 text-warning-fg"><ClockAlert size={16} aria-hidden="true" />Atrasada</span>}
          </div>
        </Link>
      </li>)}
    </ul>}
  </section>
}
