import { z } from 'zod'
import type { FieldErrors, Resolver } from 'react-hook-form'
import type { QuoteDetail, InstallationAddressPayload } from './types'

export const quoteFormSchema = z.object({
  notes: z.string(), postalCode: z.string(), street: z.string(), number: z.string(), complement: z.string(),
  neighborhood: z.string(), city: z.string(), state: z.string(),
}).superRefine((value, context) => {
  if (value.postalCode.trim() && !/^\d{8}$/.test(value.postalCode.replace(/[-\s]/g, ''))) context.addIssue({ code: 'custom', path: ['postalCode'], message: 'Informe um CEP com 8 dígitos.' })
  if (value.state.trim() && !/^[a-zA-Z]{2}$/.test(value.state.trim())) context.addIssue({ code: 'custom', path: ['state'], message: 'Informe uma UF com 2 letras.' })
})
export type QuoteFormValues = z.infer<typeof quoteFormSchema>
export type QuoteFormPayload = { notes: string | null; installationAddress: InstallationAddressPayload | null }
export const quoteFormResolver: Resolver<QuoteFormValues> = (values) => {
  const result = quoteFormSchema.safeParse(values)
  if (result.success) return { values: result.data, errors: {} }
  const errors: FieldErrors<QuoteFormValues> = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof QuoteFormValues
    if (!errors[field]) errors[field] = { type: 'validate', message: issue.message }
  }
  return { values: {}, errors }
}
const addressFields = ['postalCode', 'street', 'number', 'complement', 'neighborhood', 'city', 'state'] as const
export function quoteFormDefaults(quote?: QuoteDetail): QuoteFormValues {
  return { notes: quote?.notes ?? '', ...Object.fromEntries(addressFields.map((key) => [key, quote?.installationAddress?.[key] ?? ''])) } as QuoteFormValues
}
export function quoteFormPayload(values: QuoteFormValues): QuoteFormPayload {
  const optional = (value: string) => value.trim() ? value : null
  const address = Object.fromEntries(addressFields.map((key) => [key, optional(values[key])]))
  return { notes: optional(values.notes), installationAddress: Object.values(address).some((value) => value !== null) ? address : null }
}
