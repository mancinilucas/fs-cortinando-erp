import { z } from 'zod'
import type { FieldErrors, Resolver } from 'react-hook-form'
import { curtainFormDefaults, curtainFormPayload, curtainFormSchema } from './curtain-form'
import type { UpdateCurtainPayload } from './types'
import type { QuoteDetail, InstallationAddressPayload } from './types'

export const quoteFormSchema = z.object({
  curtains: z.array(curtainFormSchema),
  notes: z.string(), postalCode: z.string(), street: z.string(), number: z.string(), complement: z.string(),
  neighborhood: z.string(), city: z.string(), state: z.string(),
}).superRefine((value, context) => {
  if (value.postalCode.trim() && !/^\d{8}$/.test(value.postalCode.replace(/[-\s]/g, ''))) context.addIssue({ code: 'custom', path: ['postalCode'], message: 'Informe um CEP com 8 dígitos.' })
  if (value.state.trim() && !/^[a-zA-Z]{2}$/.test(value.state.trim())) context.addIssue({ code: 'custom', path: ['state'], message: 'Informe uma UF com 2 letras.' })
})
export type QuoteFormValues = z.infer<typeof quoteFormSchema>
export type QuoteFormPayload = { notes: string | null; installationAddress: InstallationAddressPayload | null; curtains?: UpdateCurtainPayload[] }
export const quoteFormResolver: Resolver<QuoteFormValues> = (values) => {
  const result = quoteFormSchema.safeParse(values)
  if (result.success) return { values: result.data, errors: {} }
  const errors: FieldErrors<QuoteFormValues> = {}
  for (const issue of result.error.issues) {
    let target = errors as Record<string, unknown>
    for (const segment of issue.path.slice(0, -1)) {
      const key = String(segment)
      if (!target[key]) target[key] = {}
      target = target[key] as Record<string, unknown>
    }
    const field = String(issue.path.at(-1))
    if (!target[field]) target[field] = { type: 'validate', message: issue.message }
  }
  return { values: {}, errors }
}
const addressFields = ['postalCode', 'street', 'number', 'complement', 'neighborhood', 'city', 'state'] as const
export function quoteFormDefaults(quote?: QuoteDetail): QuoteFormValues {
  return { curtains: quote?.curtains.map(curtainFormDefaults) ?? [], notes: quote?.notes ?? '', ...Object.fromEntries(addressFields.map((key) => [key, quote?.installationAddress?.[key] ?? ''])) } as QuoteFormValues
}
export function quoteFormPayload(values: QuoteFormValues, baseline?: QuoteFormValues): QuoteFormPayload {
  const optional = (value: string) => value.trim() ? value : null
  const address = Object.fromEntries(addressFields.map((key) => [key, optional(values[key])]))
  const curtains = !baseline || JSON.stringify(values.curtains) !== JSON.stringify(baseline.curtains) ? { curtains: values.curtains.map(curtainFormPayload) } : {}
  return { ...curtains, notes: optional(values.notes), installationAddress: Object.values(address).some((value) => value !== null) ? address : null }
}
