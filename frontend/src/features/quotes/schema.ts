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
// One financial collection: `curtainId` associates an item with a curtain and
// `null` keeps it in the general composition (ARCHITECTURE §3.4).
export const financialItemSchema = z.object({
  id: z.string(), curtainId: z.string().nullable(), name: z.string(), quantity: decimal,
  unit: text, unitPriceCents: cents.nullable(), totalCents: cents.nullable(),
})
const curtainFields = z.object({
  room: text, description: text, material: text, openingWidth: decimal, borderValue: decimal,
  height: decimal, fabricFactor: decimal, notes: text,
})
export const curtainSchema = curtainFields.extend({
  id: z.string(), sequence: z.number().int(), finalWidth: decimal, fabricQuantity: decimal, totalCents: cents,
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
  financialItems: z.array(financialItemSchema), totals: quoteTotalsSchema,
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
// Creation always uses `clientRef`/`curtainRef` because every curtain is new.
export const financialItemInputSchema = z.object({
  name: z.string(),
  curtainRef: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  unitPriceCents: cents.nullable().optional(),
})
// Update carries the complete collection. Existing items keep `id` and reference
// a curtain through `curtainId` (`null` for the general composition); new items
// for a curtain created in the same patch use `curtainRef`.
export const financialItemUpdateSchema = z.object({
  id: z.string().nullable().optional(),
  curtainId: z.string().nullable().optional(),
  curtainRef: z.string().nullable().optional(),
  name: z.string().optional(),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  unitPriceCents: cents.nullable().optional(),
}).refine((item) => item.id != null || typeof item.name === 'string', 'New financial items require a name')
// `fabricUnitPriceCents` is a creation convenience accepted on new curtains:
// the backend turns it into a normal "Tecido" item with the fabric quantity it
// derives from the curtain measures.
export const curtainInputSchema = curtainFields.partial().extend({
  clientRef: z.string().nullable().optional(), fabricUnitPriceCents: cents.nullable().optional(),
})
export const curtainUpdateSchema = curtainFields.partial().extend({
  id: z.string().nullable().optional(), clientRef: z.string().nullable().optional(),
  fabricUnitPriceCents: cents.nullable().optional(),
})
export const discountInputSchema = discountSchema.partial().required({ type: true })
const editableQuoteFields = z.object({
  notes: text.optional(), discount: discountInputSchema.nullable().optional(), commercialAdjustmentCents: cents.nullable().optional(),
  installationAddress: installationAddressSchema.partial().nullable().optional(),
})
export const createQuoteSchema = editableQuoteFields.extend({
  curtains: z.array(curtainInputSchema).optional(), financialItems: z.array(financialItemInputSchema).optional(),
})
// Omission keeps the field; a supplied collection is its complete desired state.
export const updateQuoteSchema = editableQuoteFields.extend({
  curtains: z.array(curtainUpdateSchema).optional(), financialItems: z.array(financialItemUpdateSchema).optional(),
})
export const sendQuoteSchema = z.object({ validUntil: instant.nullable().optional() })
export const renewQuoteSchema = z.object({ validUntil: instant })
export const cancelQuoteSchema = z.object({ reason: text.optional() })
export const scheduleInstallationSchema = z.object({ scheduledInstallationAt: instant })
