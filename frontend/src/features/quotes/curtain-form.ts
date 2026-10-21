import { z } from 'zod'
import { parseDecimalInput, parseMoneyInput } from './numeric-input'
import type { NumericRules } from './numeric-input'
import type { QuoteCurtain, UpdateCurtainPayload } from './types'

function numeric(places: 3 | 6, rules: NumericRules) {
  return z.string().superRefine((value, context) => {
    try { parseDecimalInput(value, places, rules) }
    catch (error) { context.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'Informe um número válido.' }) }
  })
}
export const componentFormSchema = z.object({
  serverId: z.string().optional(), name: z.string().refine((value) => Boolean(value.trim()), 'Informe o nome do componente.'),
  quantity: numeric(6, { strictlyPositive: true, max: 999999.999999 }), unit: z.string(),
  unitPrice: z.string().superRefine((value, context) => {
    try { parseMoneyInput(value, { strictlyPositive: true }) }
    catch (error) { context.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'Informe um valor válido.' }) }
  }),
})
export const curtainFormSchema = z.object({
  serverId: z.string().optional(), room: z.string(), description: z.string(), material: z.string(), notes: z.string(),
  openingWidth: numeric(3, { strictlyPositive: true, max: 999999.999 }),
  borderValue: numeric(3, { min: 0, max: 999.999 }), height: numeric(3, { strictlyPositive: true, max: 999999.999 }),
  fabricFactor: numeric(3, { strictlyPositive: true, max: 999.999 }), components: z.array(componentFormSchema),
})
export type CurtainFormValues = z.infer<typeof curtainFormSchema>
export const decimalInputValue = (value: number | null) => value === null ? '' : String(value).replace('.', ',')
export function moneyInputValue(cents: number | null): string {
  if (cents === null) return ''
  const signed = BigInt(cents)
  const value = signed < 0n ? -signed : signed
  return `${signed < 0n ? '-' : ''}${value / 100n},${(value % 100n).toString().padStart(2, '0')}`
}
export function curtainFormDefaults(curtain?: QuoteCurtain): CurtainFormValues {
  if (!curtain) return { room: '', description: '', material: '', openingWidth: '', borderValue: '0,15', height: '', fabricFactor: '3,5', notes: '', components: [] }
  return {
    serverId: curtain.id, room: curtain.room ?? '', description: curtain.description ?? '', material: curtain.material ?? '', notes: curtain.notes ?? '',
    openingWidth: decimalInputValue(curtain.openingWidth), borderValue: decimalInputValue(curtain.borderValue),
    height: decimalInputValue(curtain.height), fabricFactor: decimalInputValue(curtain.fabricFactor),
    components: curtain.components.map((component) => ({ serverId: component.id, name: component.name,
      quantity: decimalInputValue(component.quantity), unit: component.unit ?? '', unitPrice: moneyInputValue(component.unitPriceCents) })),
  }
}
export function curtainFormPayload(curtain: CurtainFormValues): UpdateCurtainPayload {
  const optional = (value: string) => value.trim() ? value : null
  return {
    ...(curtain.serverId ? { id: curtain.serverId } : {}), room: optional(curtain.room), description: optional(curtain.description),
    material: optional(curtain.material), notes: optional(curtain.notes), openingWidth: parseDecimalInput(curtain.openingWidth, 3),
    borderValue: parseDecimalInput(curtain.borderValue, 3), height: parseDecimalInput(curtain.height, 3), fabricFactor: parseDecimalInput(curtain.fabricFactor, 3),
    components: curtain.components.map((component) => ({ ...(component.serverId ? { id: component.serverId } : {}),
      name: component.name, quantity: parseDecimalInput(component.quantity, 6), unit: optional(component.unit), unitPriceCents: parseMoneyInput(component.unitPrice) })),
  }
}
