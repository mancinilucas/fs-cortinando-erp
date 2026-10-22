import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { IconButton } from './Button'
import { ToastContext } from './toast-context'

type ToastKind = 'success' | 'error'
type ToastItem = { id: number; kind: ToastKind; message: string }
const style = {
  success: { icon: CircleCheck, classes: 'border-success-border bg-success-bg text-success-fg', role: 'status' as const },
  error: { icon: CircleAlert, classes: 'border-error-border bg-error-bg text-error-fg', role: 'alert' as const },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const itemsRef = useRef<ToastItem[]>([])
  const sequence = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
    const next = itemsRef.current.filter((item) => item.id !== id)
    itemsRef.current = next
    setItems(next)
  }, [])
  const push = useCallback((kind: ToastKind, message: string) => {
    const clean = message.trim()
    if (!clean) return
    const current = itemsRef.current
    if (current.some((item) => item.kind === kind && item.message === clean)) return
    const id = ++sequence.current
    const next = [...current, { id, kind, message: clean }]
    const removed = next.length > 3 ? next.shift() : undefined
    if (removed) {
      const timer = timers.current.get(removed.id)
      if (timer) clearTimeout(timer)
      timers.current.delete(removed.id)
    }
    if (kind === 'success') timers.current.set(id, setTimeout(() => dismiss(id), 5000))
    itemsRef.current = next
    setItems(next)
  }, [dismiss])
  const success = useCallback((message: string) => push('success', message), [push])
  const error = useCallback((message: string) => push('error', message), [push])
  const api = useMemo(() => ({ success, error }), [success, error])
  useEffect(() => () => { for (const timer of timers.current.values()) clearTimeout(timer); timers.current.clear() }, [])

  return <ToastContext.Provider value={api}>
    {children}
    {items.length > 0 && <div role="region" aria-label="Notificações" className="pointer-events-none fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex max-h-[calc(100dvh-8rem)] flex-col gap-3 overflow-y-auto sm:left-auto sm:right-6 sm:w-96 lg:bottom-auto lg:top-6 lg:max-h-[calc(100dvh-3rem)]">
      {items.map(({ id, kind, message }) => {
        const { icon: Icon, classes, role } = style[kind]
        return <div key={id} className={`pointer-events-auto flex min-h-14 items-start gap-3 rounded-md border bg-surface-primary p-3 shadow-overlay ${classes}`}>
          <Icon size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
          <p role={role} className="min-w-0 flex-1 break-words text-label font-medium">{message}</p>
          <IconButton label="Fechar notificação" icon={<X size={18} />} onClick={() => dismiss(id)} className="-mr-2 -mt-2 shrink-0" />
        </div>
      })}
    </div>}
  </ToastContext.Provider>
}
