import type { ReactNode } from 'react'
import { CircleAlert, Inbox, LoaderCircle } from 'lucide-react'
import { Button } from './Button'

export function Spinner() {
  return <LoaderCircle size={20} aria-hidden="true" className="shrink-0 animate-spin motion-reduce:animate-none" />
}

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return <div role="status" className="flex items-center gap-2 p-4 text-body text-text-secondary">
    <Spinner /><span>{label}</span>
  </div>
}

export function LoadingListState({ label = 'Carregando resultados…', rows = 5 }: { label?: string; rows?: number }) {
  return <div role="status" aria-label={label} className="space-y-3 p-4">
    <span className="sr-only">{label}</span>
    <ul aria-hidden="true" className="space-y-3">
      {Array.from({ length: rows }, (_, index) => <li key={index} className="flex min-h-14 items-center gap-4 border-b border-border-default py-2 last:border-0">
        <span className="h-4 w-2/5 rounded-sm bg-surface-alt" />
        <span className="ml-auto h-4 w-1/4 rounded-sm bg-surface-alt" />
      </li>)}
    </ul>
  </div>
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="flex flex-col items-start gap-2 p-4 text-body">
    <Inbox aria-hidden="true" className="text-text-secondary" />
    <p className="font-semibold text-text-primary">{title}</p>
    {children && <div className="text-text-secondary">{children}</div>}
  </div>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="flex flex-col items-start gap-3 p-4">
    <p role="alert" className="flex items-start gap-2 text-body text-error-fg">
      <CircleAlert aria-hidden="true" className="shrink-0" /><span>{message}</span>
    </p>
    {onRetry && <Button variant="secondary" onClick={onRetry}>Tentar novamente</Button>}
  </div>
}
