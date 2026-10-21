import type { ComponentPropsWithRef } from 'react'
import clsx from 'clsx'

export function Surface({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <div {...props} className={clsx('rounded-md border border-border-default bg-surface-primary p-4 sm:p-6', className)} />
}
