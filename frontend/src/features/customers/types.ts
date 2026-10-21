import type { z } from 'zod'
import type { customerAddressSchema, customerSummarySchema, customerDetailSchema, createCustomerSchema, updateCustomerSchema, customerQuoteSchema } from './schema'

export type CustomerAddress = z.infer<typeof customerAddressSchema>
export type CustomerSummary = z.infer<typeof customerSummarySchema>
export type CustomerDetail = z.infer<typeof customerDetailSchema>
export type CreateCustomerPayload = z.infer<typeof createCustomerSchema>
export type UpdateCustomerPayload = z.infer<typeof updateCustomerSchema>
export type CustomerQuote = z.infer<typeof customerQuoteSchema>
