import { Link } from 'react-router'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { formatDate, formatDateTime } from '@/shared/format/dates'
import { formatMoney } from '@/shared/format/money'
import type { QuoteSummary } from './types'

export function QuoteRow({ quote }: { quote: QuoteSummary }) {
  return <li><Link to={`/orcamentos/${encodeURIComponent(quote.id)}`} className="grid min-h-14 min-w-0 gap-3 p-4 hover:bg-surface-alt sm:grid-cols-2 lg:grid-cols-3">
    <span className="min-w-0 break-words"><span className="block font-semibold text-brand-navy">{quote.quoteNumber}</span><span className="block text-label">{quote.customer.name}</span></span>
    <span className="flex flex-wrap items-center gap-2"><StatusBadge status={quote.status} />{quote.expired && <StatusBadge status="EXPIRED" />}</span>
    <span className="font-semibold tabular-nums">{formatMoney(quote.totalCents)}</span>
    <span className="text-label text-text-secondary">Criação: {formatDate(quote.createdAt)}</span>
    {quote.scheduledInstallationAt && <span className="text-label text-text-secondary sm:col-span-2">Instalação: {formatDateTime(quote.scheduledInstallationAt)}</span>}
  </Link></li>
}
