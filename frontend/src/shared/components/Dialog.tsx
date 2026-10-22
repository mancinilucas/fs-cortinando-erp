import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './Button'

type DialogProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
}

export function Dialog({ open, onClose, title, description, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const id = useId()
  const modalActive = useRef(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    const previousFocus = document.activeElement
    modalActive.current = true
    dialog.showModal()
    titleRef.current?.focus()
    return () => {
      modalActive.current = false
      dialog.close()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [open])

  return <dialog ref={dialogRef} aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined}
    onCancel={(event) => { event.preventDefault(); onClose() }}
    onClose={() => { if (modalActive.current && !dialogRef.current?.open) onClose() }}
    className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[32.5rem] overflow-y-auto rounded-md border border-border-default bg-surface-primary p-4 text-text-primary shadow-overlay backdrop:bg-surface-overlay sm:p-6">
    <div className="flex items-start justify-between gap-4">
      <h2 ref={titleRef} id={`${id}-title`} tabIndex={-1} className="text-section-title font-semibold">{title}</h2>
      <IconButton label="Fechar diálogo" icon={<X size={20} />} onClick={onClose} />
    </div>
    {description && <p id={`${id}-description`} className="mt-2 text-body text-text-secondary">{description}</p>}
    <div className="mt-4">{children}</div>
  </dialog>
}
