import type { QuoteDetail, QuoteSummary } from './types'

export const quoteFixture: QuoteDetail = {
  id: 'quote-1', quoteNumber: 'ORC-2026-001', customerId: 'customer-1', status: 'DRAFT', notes: null,
  discount: { type: 'NO_DISCOUNT', percentage: null, fixedAmountCents: null }, commercialAdjustmentCents: null,
  installationAddress: { postalCode: null, street: null, number: null, complement: null, neighborhood: null, city: 'São Paulo', state: null },
  curtains: [{ id: 'curtain-1', sequence: 1, room: null, description: null, material: null, openingWidth: 2.123,
    borderValue: null, finalWidth: 7.321, height: null, fabricFactor: null, fabricQuantity: 8.765, notes: null,
    components: [{ id: 'component-1', name: 'Tecido', quantity: 1.123456, unit: null, unitPriceCents: 100, totalCents: 987 }], totalCents: 987 }],
  generalAddOns: [], totals: { curtainsSubtotalCents: 987, generalAddOnsSubtotalCents: 0, subtotalCents: 987,
    discountValueCents: 0, calculatedTotalCents: 987, commercialAdjustmentCents: 0, totalCents: 987 },
  createdAt: '2026-10-01T12:00:00.000Z', updatedAt: '2026-10-01T12:00:00.000Z', firstSentAt: null,
  validUntil: null, confirmedAt: null, productionStartedAt: null, scheduledInstallationAt: null, completedAt: null,
  expired: false, lateInstallation: false,
}
export const quoteSummaryFixture: QuoteSummary = {
  id: quoteFixture.id, quoteNumber: quoteFixture.quoteNumber, customer: { id: 'customer-1', name: 'Ana' },
  status: 'SENT', expired: true, totalCents: 987, createdAt: quoteFixture.createdAt, validUntil: null, scheduledInstallationAt: null,
}
