import { z } from 'zod'
import type { FieldErrors, Resolver } from 'react-hook-form'
import type { CreateCustomerPayload, CustomerDetail, UpdateCustomerPayload } from './types'

const required = (message: string) => z.string().refine((value) => value.trim().length > 0, message)
export const customerFormSchema = z.object({
  name: required('Informe o nome.'), phone: required('Informe o telefone.'),
  email: z.string().refine((value) => !value.trim() || z.email().safeParse(value.trim()).success, 'Informe um e-mail válido.'),
  taxId: z.string().refine((value) => !value.trim() || /^(\d{11}|\d{14})$/.test(value.replace(/\D/g, '')), 'Informe CPF com 11 dígitos ou CNPJ com 14 dígitos.'),
  notes: z.string(), addressEnabled: z.boolean(),
  street: z.string(), number: z.string(), neighborhood: z.string(), city: z.string(),
  postalCode: z.string(), complement: z.string(), state: z.string(),
}).superRefine((values, context) => {
  if (!values.addressEnabled) return
  for (const [field, label] of [['street', 'a rua'], ['number', 'o número'], ['neighborhood', 'o bairro'], ['city', 'a cidade']] as const) {
    if (!values[field].trim()) context.addIssue({ code: 'custom', path: [field], message: `Informe ${label}.` })
  }
  if (values.postalCode.trim() && !/^\d{8}$/.test(values.postalCode.replace(/\D/g, ''))) context.addIssue({ code: 'custom', path: ['postalCode'], message: 'Informe um CEP com 8 dígitos.' })
  if (values.state.trim() && !/^[a-zA-Z]{2}$/.test(values.state.trim())) context.addIssue({ code: 'custom', path: ['state'], message: 'Informe uma UF com 2 letras.' })
})
export type CustomerFormValues = z.infer<typeof customerFormSchema>
export const customerFormResolver: Resolver<CustomerFormValues> = (values) => {
  const result = customerFormSchema.safeParse(values)
  if (result.success) return { values: result.data, errors: {} }
  const errors: FieldErrors<CustomerFormValues> = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof CustomerFormValues
    if (!errors[field]) errors[field] = { type: 'validate', message: issue.message }
  }
  return { values: {}, errors }
}
export function customerFormDefaults(customer?: CustomerDetail): CustomerFormValues {
  return {
    name: customer?.name ?? '', phone: customer?.phone ?? '', email: customer?.email ?? '', taxId: customer?.taxId ?? '', notes: customer?.notes ?? '',
    addressEnabled: Boolean(customer?.address), street: customer?.address?.street ?? '', number: customer?.address?.number ?? '',
    neighborhood: customer?.address?.neighborhood ?? '', city: customer?.address?.city ?? '', postalCode: customer?.address?.postalCode ?? '',
    complement: customer?.address?.complement ?? '', state: customer?.address?.state ?? '',
  }
}
function optional(value: string) { return value.trim() ? value : null }
export function customerFormPayload(values: CustomerFormValues): CreateCustomerPayload {
  return {
    name: values.name, phone: values.phone, email: optional(values.email), taxId: optional(values.taxId), notes: optional(values.notes),
    address: values.addressEnabled ? {
      street: values.street, number: values.number, neighborhood: values.neighborhood, city: values.city,
      postalCode: optional(values.postalCode), complement: optional(values.complement), state: optional(values.state),
    } : null,
  }
}
export function customerFormPatch(values: CustomerFormValues, baseline: CustomerFormValues): UpdateCustomerPayload {
  const current = customerFormPayload(values)
  const original = customerFormPayload(baseline)
  const patch: UpdateCustomerPayload = {}
  for (const key of ['name', 'phone'] as const) {
    if (current[key] !== original[key]) patch[key] = current[key]
  }
  for (const key of ['email', 'taxId', 'notes'] as const) {
    if (current[key] !== original[key]) patch[key] = current[key]
  }
  if (JSON.stringify(current.address) !== JSON.stringify(original.address)) patch.address = current.address
  return patch
}
