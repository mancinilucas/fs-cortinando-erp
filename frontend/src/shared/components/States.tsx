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
