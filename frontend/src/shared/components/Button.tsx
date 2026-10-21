import type { ComponentPropsWithRef, ReactNode } from 'react'
import clsx from 'clsx'

type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'destructive' | 'text'
}

const variants = {
  primary: 'border-transparent bg-brand-navy text-text-inverse enabled:hover:brightness-90',
  secondary: 'border-border-control bg-surface-primary text-brand-navy enabled:hover:bg-surface-alt',
  destructive: 'border-transparent bg-error-fg text-text-inverse enabled:hover:brightness-90',
  text: 'border-transparent bg-transparent text-brand-navy enabled:hover:underline',
}

export function Button({ type = 'button', variant = 'primary', className, ...props }: ButtonProps) {
  return <button {...props} type={type} className={clsx(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border px-4 py-2 font-sans text-button font-semibold disabled:cursor-not-allowed disabled:border-border-default disabled:bg-surface-alt disabled:text-text-secondary',
    variants[variant], className,
  )} />
}

type IconButtonProps = Omit<ButtonProps, 'children' | 'aria-label'> & {
  label: string
  icon: ReactNode
}

export function IconButton({ label, icon, className, variant = 'text', ...props }: IconButtonProps) {
  return <Button {...props} variant={variant} aria-label={label} title={label} className={clsx('min-w-11 px-2', className)}>
    <span aria-hidden="true" className="inline-flex">{icon}</span>
  </Button>
}
