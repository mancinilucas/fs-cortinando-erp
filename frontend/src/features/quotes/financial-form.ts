import { z } from 'zod'
import { componentFormSchema, decimalInputValue, moneyInputValue } from './curtain-form'
import { parseDecimalInput, parseMoneyInput } from './numeric-input'
import type { QuoteDetail, QuoteDiscountPayload, UpdateFinancialItemPayload } from './types'

export const addOnFormSchema = componentFormSchema.extend({ name: z.string().refine((value) => Boolean(value.trim()), 'Informe o nome do adicional.') })
export const financialFormSchema = z.object({
  generalAddOns: z.array(addOnFormSchema),
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
export function financialFormDefaults(quote?: QuoteDetail): FinancialFormValues {
  return {
    generalAddOns: quote?.generalAddOns.map((item) => ({ serverId: item.id, name: item.name, quantity: decimalInputValue(item.quantity), unit: item.unit ?? '', unitPrice: moneyInputValue(item.unitPriceCents) })) ?? [],
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
export function addOnsFormPayload(values: FinancialFormValues): UpdateFinancialItemPayload[] {
  return values.generalAddOns.map((item) => ({ ...(item.serverId ? { id: item.serverId } : {}), name: item.name,
    quantity: parseDecimalInput(item.quantity, 6), unit: item.unit.trim() ? item.unit : null, unitPriceCents: parseMoneyInput(item.unitPrice) }))
}
