import type { z } from 'zod'
import type * as schemas from './schema'

export type QuoteStatus = z.infer<typeof schemas.quoteStatusSchema>
export type QuoteSearch = z.infer<typeof schemas.quoteSearchSchema>
export type QuoteSummary = z.infer<typeof schemas.quoteSummarySchema>
export type QuoteDetail = z.infer<typeof schemas.quoteDetailSchema>
export type QuoteCurtain = z.infer<typeof schemas.curtainSchema>
export type QuoteComponent = z.infer<typeof schemas.financialItemSchema>
export type QuoteGeneralAddOn = QuoteComponent
export type QuoteDiscount = z.infer<typeof schemas.discountSchema>
export type QuoteTotals = z.infer<typeof schemas.quoteTotalsSchema>
export type QuoteHistoryEntry = z.infer<typeof schemas.quoteHistorySchema>
export type InstallationAddress = z.infer<typeof schemas.installationAddressSchema>
export type InstallationAddressPayload = NonNullable<z.infer<typeof schemas.createQuoteSchema>['installationAddress']>
export type QuoteDiscountPayload = z.infer<typeof schemas.discountInputSchema>
export type CreateQuotePayload = z.infer<typeof schemas.createQuoteSchema>
export type UpdateQuotePayload = z.infer<typeof schemas.updateQuoteSchema>
export type CreateCurtainPayload = z.infer<typeof schemas.curtainInputSchema>
export type UpdateCurtainPayload = z.infer<typeof schemas.curtainUpdateSchema>
export type CreateFinancialItemPayload = z.infer<typeof schemas.financialItemInputSchema>
export type UpdateFinancialItemPayload = z.infer<typeof schemas.financialItemUpdateSchema>
export type SendQuotePayload = z.infer<typeof schemas.sendQuoteSchema>
export type RenewQuotePayload = z.infer<typeof schemas.renewQuoteSchema>
export type CancelQuotePayload = z.infer<typeof schemas.cancelQuoteSchema>
export type ScheduleInstallationPayload = z.infer<typeof schemas.scheduleInstallationSchema>
export type QuoteDocument = Blob
