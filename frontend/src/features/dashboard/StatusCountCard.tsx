import { Link } from 'react-router'
import type { QuoteDisplayStatus } from '@/shared/format/labels'

export function StatusCountCard({ label, count, status }: { label: string; count: number; status: QuoteDisplayStatus }) {
  return <Link to={`/orcamentos?status=${status}`} aria-label={`${label}: ${count}`}
    className="flex min-h-28 min-w-0 flex-col justify-between gap-3 rounded-md border border-border-default bg-surface-primary p-4 hover:border-border-control">
    <span className="text-label text-text-secondary">{label}</span>
    <span className="break-words text-numeric-large font-semibold text-brand-navy tabular-nums">{count}</span>
  </Link>
}
