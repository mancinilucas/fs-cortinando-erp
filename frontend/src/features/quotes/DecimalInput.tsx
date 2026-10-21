import { useState } from 'react'
import type { ComponentPropsWithRef } from 'react'
import { TextField } from '@/shared/components/FormFields'
import { parseDecimalInput } from './numeric-input'
import type { NumericRules } from './numeric-input'

type Props = Omit<ComponentPropsWithRef<typeof TextField>, 'type' | 'inputMode'> & {
  decimalPlaces?: 2 | 3 | 6; rules?: NumericRules
}
export function DecimalInput({ decimalPlaces = 3, rules = { min: 0 }, onBlur, error, ...props }: Props) {
  const [localError, setLocalError] = useState<string>()
  return <TextField {...props} error={error ?? localError} type="text" inputMode="decimal" onBlur={(event) => {
    try { parseDecimalInput(event.target.value, decimalPlaces, rules); setLocalError(undefined) }
    catch (failure) { setLocalError(failure instanceof Error ? failure.message : 'Informe um número válido.') }
    onBlur?.(event)
  }} />
}
