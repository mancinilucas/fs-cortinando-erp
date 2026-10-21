import { z } from 'zod'

export const customerAddressSchema = z.object({
  street: z.string(), number: z.string(), neighborhood: z.string(), city: z.string(),
  postalCode: z.string().nullable().optional(), complement: z.string().nullable().optional(), state: z.string().nullable().optional(),
})
export const customerSummarySchema = z.object({ id: z.string(), name: z.string(), phone: z.string(), email: z.string().nullable() })
export const customerDetailSchema = customerSummarySchema.extend({
  taxId: z.string().nullable(), address: customerAddressSchema.nullable(), notes: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }), updatedAt: z.iso.datetime({ offset: true }),
})
export const createCustomerSchema = z.object({
  name: z.string(), phone: z.string(), email: z.string().nullable().optional(), taxId: z.string().nullable().optional(),
  address: customerAddressSchema.nullable().optional(), notes: z.string().nullable().optional(),
})
export const updateCustomerSchema = createCustomerSchema.partial().refine(
  (value) => Object.values(value).some((field) => field !== undefined), 'Customer patch must contain a changed field',
)
export const customerQuoteSchema = z.object({
  id: z.string(), quoteNumber: z.string(), customer: z.object({ id: z.string(), name: z.string() }),
  status: z.enum(['DRAFT', 'SENT', 'CONFIRMED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED']),
  expired: z.boolean(), totalCents: z.number().int(), createdAt: z.iso.datetime({ offset: true }),
  validUntil: z.iso.datetime({ offset: true }).nullable(), scheduledInstallationAt: z.iso.datetime({ offset: true }).nullable(),
})
