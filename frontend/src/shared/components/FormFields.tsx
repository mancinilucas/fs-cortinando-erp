import { useId } from 'react'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import clsx from 'clsx'
import { CircleAlert } from 'lucide-react'

type FieldProps = { label: string; error?: string; hint?: string }
type FieldModel = ReturnType<typeof useFieldModel>

function useFieldModel(id: string | undefined, error: string | undefined, hint: string | undefined, describedBy: string | undefined) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const errorId = `${controlId}-error`
  const hintId = `${controlId}-hint`
  return {
    controlId, errorId, hintId,
    describedBy: [describedBy, hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined,
  }
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return <p id={id} role="alert" className="flex items-start gap-2 text-caption text-error-fg">
    <CircleAlert size={16} aria-hidden="true" className="shrink-0" />
    <span>{children}</span>
  </p>
}

function FieldFrame({ label, error, hint, model, children }: FieldProps & { model: FieldModel; children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-2">
    <label htmlFor={model.controlId} className="text-label font-medium text-text-primary">{label}</label>
    {children}
    {hint && <p id={model.hintId} className="text-caption text-text-secondary">{hint}</p>}
    {error && <FieldError id={model.errorId}>{error}</FieldError>}
  </div>
}

const controlClasses = 'min-h-11 w-full min-w-0 rounded-sm border bg-surface-primary px-3 py-2 font-sans text-body text-text-primary disabled:cursor-not-allowed disabled:bg-surface-alt disabled:text-text-secondary'

export function TextField({ label, error, hint, id, className, 'aria-describedby': describedBy, 'aria-invalid': invalid, ...props }: ComponentPropsWithRef<'input'> & FieldProps) {
  const model = useFieldModel(id, error, hint, describedBy)
  return <FieldFrame label={label} error={error} hint={hint} model={model}>
    <input {...props} id={model.controlId} aria-describedby={model.describedBy} aria-invalid={error ? true : invalid}
      className={clsx(controlClasses, error ? 'border-error-fg' : 'border-border-control', className)} />
  </FieldFrame>
}

export function TextArea({ label, error, hint, id, className, 'aria-describedby': describedBy, 'aria-invalid': invalid, ...props }: ComponentPropsWithRef<'textarea'> & FieldProps) {
  const model = useFieldModel(id, error, hint, describedBy)
  return <FieldFrame label={label} error={error} hint={hint} model={model}>
    <textarea {...props} id={model.controlId} aria-describedby={model.describedBy} aria-invalid={error ? true : invalid}
      className={clsx(controlClasses, 'min-h-24 resize-y', error ? 'border-error-fg' : 'border-border-control', className)} />
  </FieldFrame>
}

export function Select({ label, error, hint, id, className, children, 'aria-describedby': describedBy, 'aria-invalid': invalid, ...props }: ComponentPropsWithRef<'select'> & FieldProps) {
  const model = useFieldModel(id, error, hint, describedBy)
  return <FieldFrame label={label} error={error} hint={hint} model={model}>
    <select {...props} id={model.controlId} aria-describedby={model.describedBy} aria-invalid={error ? true : invalid}
      className={clsx(controlClasses, error ? 'border-error-fg' : 'border-border-control', className)}>{children}</select>
  </FieldFrame>
}
