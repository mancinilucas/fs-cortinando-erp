import { z } from 'zod'
import { decimalInputValue, moneyField, moneyInputValue, numericField } from './curtain-form'
import { parseDecimalInput, parseMoneyInput } from './numeric-input'
import type { CurtainFormValues } from './curtain-form'
import type { QuoteDetail, QuoteDiscountPayload, QuoteFinancialItem, UpdateFinancialItemPayload } from './types'

// Every financial item is one row of the quote's single collection. `curtainKey`
// is the local association: the server id of a persisted curtain, the clientRef
// of a curtain created in this draft, or null for the general composition.
export const financialItemFormSchema = z.object({
  serverId: z.string().optional(),
  curtainKey: z.string().nullable(),
  name: z.string().refine((value) => Boolean(value.trim()), 'Informe o nome.'),
  quantity: numericField(6, { strictlyPositive: true, max: 999999.999999 }), unit: z.string(),
  unitPrice: moneyField({ strictlyPositive: true }),
})
export type FinancialItemFormValues = z.infer<typeof financialItemFormSchema>
export type FinancialFieldArray = {
  fields: Array<FinancialItemFormValues & { id: string }>
  append: (value: FinancialItemFormValues) => void
  remove: (index?: number | number[]) => void
  move: (from: number, to: number) => void
}
export const financialFormSchema = z.object({
  discountType: z.enum(['NO_DISCOUNT', 'PERCENTAGE', 'FIXED_AMOUNT']),
  discountPercentage: z.string(), discountFixedAmount: z.string(), commercialAdjustment: z.string(),
}).superRefine((values, context) => {
  if (values.discountType !== 'NO_DISCOUNT') {
    const field = values.discountType === 'PERCENTAGE' ? 'discountPercentage' : 'discountFixedAmount'
    try {
      const value = field === 'discountPercentage' ? parseDecimalInput(values[field], 2, { strictlyPositive: true, max: 100 }) : parseMoneyInput(values[field], { strictlyPositive: true })
      if (value === null) context.addIssue({ code: 'custom', path: [field], message: 'Informe o valor do desconto.' })
    } catch (error) { context.addIssue({ code: 'custom', path: [field], message: error instanceof Error ? error.message : 'Informe um desconto válido.' }) }
  }
  try { parseMoneyInput(values.commercialAdjustment) }
  catch (error) { context.addIssue({ code: 'custom', path: ['commercialAdjustment'], message: error instanceof Error ? error.message : 'Informe um ajuste válido.' }) }
})
export type FinancialFormValues = z.infer<typeof financialFormSchema>
export function financialItemFormDefaults(item: QuoteFinancialItem): FinancialItemFormValues {
  return { serverId: item.id, curtainKey: item.curtainId, name: item.name, quantity: decimalInputValue(item.quantity),
    unit: item.unit ?? '', unitPrice: moneyInputValue(item.unitPriceCents) }
}
export function financialFormDefaults(quote?: QuoteDetail): FinancialFormValues {
  return {
    discountType: quote?.discount.type ?? 'NO_DISCOUNT', discountPercentage: decimalInputValue(quote?.discount.percentage ?? null),
    discountFixedAmount: moneyInputValue(quote?.discount.fixedAmountCents ?? null), commercialAdjustment: moneyInputValue(quote?.commercialAdjustmentCents ?? null),
  }
}
export function discountFormPayload(values: FinancialFormValues): QuoteDiscountPayload {
  switch (values.discountType) {
    case 'PERCENTAGE': return { type: 'PERCENTAGE', percentage: parseDecimalInput(values.discountPercentage, 2, { strictlyPositive: true, max: 100 }), fixedAmountCents: null }
    case 'FIXED_AMOUNT': return { type: 'FIXED_AMOUNT', percentage: null, fixedAmountCents: parseMoneyInput(values.discountFixedAmount, { strictlyPositive: true }) }
    case 'NO_DISCOUNT': return { type: 'NO_DISCOUNT', percentage: null, fixedAmountCents: null }
  }
}
// `target` is the curtain form row resolved from `curtainKey`; null means the
// item belongs to the general composition. New items for a curtain created in
// this draft use `curtainRef`; existing items and existing curtains use
// `curtainId`, which the server reconciles by id.
export function financialItemFormPayload(item: FinancialItemFormValues, target: CurtainFormValues | null): UpdateFinancialItemPayload {
  const association = target === null
    ? { curtainId: null }
    : target.serverId
      ? { curtainId: target.serverId }
      : { curtainRef: target.clientRef }
  const optional = (value: string) => value.trim() ? value : null
  return {
    ...(item.serverId ? { id: item.serverId } : {}), ...association, name: item.name,
    quantity: parseDecimalInput(item.quantity, 6), unit: optional(item.unit), unitPriceCents: parseMoneyInput(item.unitPrice),
  }
}
