import { useState } from 'react'
import type { ComponentPropsWithRef } from 'react'
import { TextField } from '@/shared/components/FormFields'
import { parseMoneyInput } from './numeric-input'
import type { NumericRules } from './numeric-input'

type Props = Omit<ComponentPropsWithRef<typeof TextField>, 'type' | 'inputMode'> & { rules?: NumericRules }
export function MoneyInput({ rules = { min: 0 }, onBlur, onChange, error, ...props }: Props) {
  const [localError, setLocalError] = useState<string>()
  return <TextField hint="Valor em reais, sem separador de milhar." {...props} error={props.disabled ? undefined : error ?? localError} type="text" inputMode="decimal" onChange={(event) => { setLocalError(undefined); onChange?.(event) }} onBlur={(event) => {
    try { parseMoneyInput(event.target.value, rules); setLocalError(undefined) }
    catch (failure) { setLocalError(failure instanceof Error ? failure.message : 'Informe um valor válido.') }
    onBlur?.(event)
  }} />
}
