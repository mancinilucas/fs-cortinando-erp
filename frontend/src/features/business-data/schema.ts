import { z } from 'zod'

export const businessDataSchema = z.object({
  commercialNameOrConsultant: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  taxId: z.string().nullable(),
  updatedAt: z.iso.datetime({ offset: true }),
})

export const businessDataFormSchema = z.object({
  commercialNameOrConsultant: z.string().trim().min(1, 'Informe o nome comercial ou da consultora.'),
  phone: z.string().trim().min(1, 'Informe o telefone.'),
  email: z.union([z.literal(''), z.email('Informe um e-mail válido.')]),
  taxId: z.string(),
})

export type BusinessDataFormValues = z.infer<typeof businessDataFormSchema>
