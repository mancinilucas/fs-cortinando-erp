import { z } from 'zod'
import { parseDecimalInput, parseMoneyInput } from './numeric-input'
import type { NumericRules } from './numeric-input'
import type { QuoteCurtain, UpdateCurtainPayload } from './types'

export function numericField(places: 3 | 6, rules: NumericRules) {
  return z.string().superRefine((value, context) => {
    try { parseDecimalInput(value, places, rules) }
    catch (error) { context.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'Informe um número válido.' }) }
  })
}
export function moneyField(rules: NumericRules) {
  return z.string().superRefine((value, context) => {
    try { parseMoneyInput(value, rules) }
    catch (error) { context.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'Informe um valor válido.' }) }
  })
}
const numeric = numericField
// `serverId` identifies a persisted curtain; `clientRef` identifies a curtain
// created in the current draft so its financial items can reference it before
// the server assigns the definitive id.
export const curtainFormSchema = z.object({
  serverId: z.string().optional(), clientRef: z.string().optional(),
  room: z.string(), description: z.string(), material: z.string(), notes: z.string(),
  openingWidth: numeric(3, { strictlyPositive: true, max: 999999.999 }),
  borderValue: numeric(3, { min: 0, max: 999.999 }), height: numeric(3, { strictlyPositive: true, max: 999999.999 }),
  fabricFactor: numeric(3, { strictlyPositive: true, max: 999.999 }),
  // Only sent for a curtain created in the current save. The backend derives
  // the fabric quantity and materializes the "Tecido" financial item.
  fabricPrice: moneyField({ strictlyPositive: true }),
})
export type CurtainFormValues = z.infer<typeof curtainFormSchema>
export const decimalInputValue = (value: number | null) => value === null ? '' : String(value).replace('.', ',')
export function moneyInputValue(cents: number | null): string {
  if (cents === null) return ''
  const signed = BigInt(cents)
  const value = signed < 0n ? -signed : signed
  return `${signed < 0n ? '-' : ''}${value / 100n},${(value % 100n).toString().padStart(2, '0')}`
}
let clientRefCounter = 0
export function newCurtainClientRef(): string { return `new-curtain-${++clientRefCounter}` }
export function curtainFormDefaults(curtain?: QuoteCurtain): CurtainFormValues {
  if (!curtain) return { clientRef: newCurtainClientRef(), room: '', description: '', material: '', openingWidth: '', borderValue: '0,15', height: '', fabricFactor: '3,5', notes: '', fabricPrice: '' }
  return {
    serverId: curtain.id, room: curtain.room ?? '', description: curtain.description ?? '', material: curtain.material ?? '', notes: curtain.notes ?? '',
    openingWidth: decimalInputValue(curtain.openingWidth), borderValue: decimalInputValue(curtain.borderValue),
    height: decimalInputValue(curtain.height), fabricFactor: decimalInputValue(curtain.fabricFactor), fabricPrice: '',
  }
}
export function curtainFormPayload(curtain: CurtainFormValues): UpdateCurtainPayload {
  const optional = (value: string) => value.trim() ? value : null
  const fabricUnitPriceCents = curtain.serverId ? null : parseMoneyInput(curtain.fabricPrice, { strictlyPositive: true })
  return {
    ...(curtain.serverId ? { id: curtain.serverId } : { clientRef: curtain.clientRef }),
    room: optional(curtain.room), description: optional(curtain.description),
    material: optional(curtain.material), notes: optional(curtain.notes), openingWidth: parseDecimalInput(curtain.openingWidth, 3),
    borderValue: parseDecimalInput(curtain.borderValue, 3), height: parseDecimalInput(curtain.height, 3), fabricFactor: parseDecimalInput(curtain.fabricFactor, 3),
    ...(fabricUnitPriceCents === null ? {} : { fabricUnitPriceCents }),
  }
}
