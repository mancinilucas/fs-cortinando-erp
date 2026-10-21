import { Check, CheckCheck, ClockAlert, Minus, Pencil, Send, Settings } from 'lucide-react'
import clsx from 'clsx'
import { quoteStatusLabels } from '@/shared/format/labels'
import type { QuoteDisplayStatus } from '@/shared/format/labels'
import { quoteStatusMetadata } from '@/shared/format/status'

const icons = { pencil: Pencil, send: Send, 'clock-alert': ClockAlert, check: Check, settings: Settings, 'check-check': CheckCheck, minus: Minus }

export function StatusBadge({ status, className }: { status: QuoteDisplayStatus; className?: string }) {
  const metadata = quoteStatusMetadata[status]
  const Icon = icons[metadata.icon]
  return <span className={clsx('inline-flex min-h-6 items-center gap-1 rounded-sm border px-2 text-caption font-medium', metadata.className, className)}>
    <Icon size={14} aria-hidden="true" />{quoteStatusLabels[status]}
  </span>
}
