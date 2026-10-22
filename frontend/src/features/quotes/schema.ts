import { z } from 'zod'

const instant = z.iso.datetime({ offset: true })
const cents = z.number().int()
const text = z.string().nullable()
const decimal = z.number().nullable()
export const quoteStatusSchema = z.enum(['DRAFT', 'SENT', 'CONFIRMED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED'])
export const quoteSearchSchema = z.object({ search: z.string().optional(), status: z.enum([...quoteStatusSchema.options, 'EXPIRED']).optional() })
export const quoteSummarySchema = z.object({
  id: z.string(), quoteNumber: z.string(), customer: z.object({ id: z.string(), name: z.string() }),
  status: quoteStatusSchema, expired: z.boolean(), totalCents: cents, createdAt: instant,
  validUntil: instant.nullable(), scheduledInstallationAt: instant.nullable(),
})
export const installationAddressSchema = z.object({
  postalCode: text, street: text, number: text, complement: text, neighborhood: text, city: text, state: text,
})
export const financialItemSchema = z.object({
  id: z.string(), name: z.string(), quantity: decimal, unit: text, unitPriceCents: cents.nullable(), totalCents: cents.nullable(),
})
const curtainFields = z.object({
  room: text, description: text, material: text, openingWidth: decimal, borderValue: decimal,
  height: decimal, fabricFactor: decimal, notes: text,
})
export const curtainSchema = curtainFields.extend({
  id: z.string(), sequence: z.number().int(), finalWidth: decimal, fabricQuantity: decimal,
  components: z.array(financialItemSchema), totalCents: cents,
})
export const discountSchema = z.object({
  type: z.enum(['NO_DISCOUNT', 'PERCENTAGE', 'FIXED_AMOUNT']), percentage: decimal, fixedAmountCents: cents.nullable(),
})
export const quoteTotalsSchema = z.object({
  curtainsSubtotalCents: cents, generalAddOnsSubtotalCents: cents, subtotalCents: cents,
  discountValueCents: cents, calculatedTotalCents: cents, commercialAdjustmentCents: cents, totalCents: cents,
})
export const quoteDetailSchema = z.object({
  id: z.string(), quoteNumber: z.string(), customerId: z.string(), status: quoteStatusSchema,
  notes: text, discount: discountSchema, commercialAdjustmentCents: cents.nullable(),
  installationAddress: installationAddressSchema.nullable(), curtains: z.array(curtainSchema),
  generalAddOns: z.array(financialItemSchema), totals: quoteTotalsSchema,
  createdAt: instant, updatedAt: instant, firstSentAt: instant.nullable(), validUntil: instant.nullable(),
  confirmedAt: instant.nullable(), productionStartedAt: instant.nullable(), scheduledInstallationAt: instant.nullable(),
  completedAt: instant.nullable(), expired: z.boolean(), lateInstallation: z.boolean(),
})
export const quoteHistorySchema = z.object({
  id: z.string(), eventType: z.enum([
    'QUOTE_CREATED', 'QUOTE_SENT', 'QUOTE_EDITED', 'QUOTE_CONFIRMED', 'QUOTE_REOPENED', 'QUOTE_RENEWED',
    'QUOTE_CANCELLED', 'PRODUCTION_STARTED', 'INSTALLATION_SCHEDULED', 'INSTALLATION_CHANGED',
    'INSTALLATION_REMOVED', 'SERVICE_COMPLETED', 'COMMERCIAL_PDF_GENERATED', 'PRODUCTION_ORDER_GENERATED',
  ]), occurredAt: instant, details: z.unknown(),
})

// Only editable fields cross the write boundary. Derived fields are response-only.
export const financialItemInputSchema = financialItemSchema.omit({ id: true, totalCents: true }).partial().required({ name: true })
export const financialItemUpdateSchema = financialItemInputSchema.partial().extend({ id: z.string().nullable().optional() })
  .refine((item) => item.id != null || typeof item.name === 'string', 'New financial items require a name')
export const curtainInputSchema = curtainFields.partial().extend({ components: z.array(financialItemInputSchema).optional() })
export const curtainUpdateSchema = curtainFields.partial().extend({
  id: z.string().nullable().optional(), components: z.array(financialItemUpdateSchema).optional(),
})
export const discountInputSchema = discountSchema.partial().required({ type: true })
const editableQuoteFields = z.object({
  notes: text.optional(), discount: discountInputSchema.nullable().optional(), commercialAdjustmentCents: cents.nullable().optional(),
  installationAddress: installationAddressSchema.partial().nullable().optional(),
})
export const createQuoteSchema = editableQuoteFields.extend({
  curtains: z.array(curtainInputSchema).optional(), generalAddOns: z.array(financialItemInputSchema).optional(),
})
// Omission keeps the field; a supplied collection is its complete desired state.
export const updateQuoteSchema = editableQuoteFields.extend({
  curtains: z.array(curtainUpdateSchema).optional(), generalAddOns: z.array(financialItemUpdateSchema).optional(),
})
export const sendQuoteSchema = z.object({ validUntil: instant.nullable().optional() })
export const renewQuoteSchema = z.object({ validUntil: instant })
export const cancelQuoteSchema = z.object({ reason: text.optional() })
export const scheduleInstallationSchema = z.object({ scheduledInstallationAt: instant })
