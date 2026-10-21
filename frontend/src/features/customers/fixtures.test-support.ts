import type { CustomerDetail, CustomerQuote } from './types'

export const customerFixture: CustomerDetail = {
  id: 'customer-1', name: 'Cliente de teste', phone: '11912345678', email: null, taxId: null,
  address: { street: 'Rua de teste', number: '10', neighborhood: 'Centro', city: 'São Paulo', postalCode: null, complement: null, state: 'SP' },
  notes: null, createdAt: '2026-10-01T12:00:00.000Z', updatedAt: '2026-10-02T12:00:00.000Z',
}
export const customerQuotesFixture: CustomerQuote[] = [{
  id: 'quote-1', quoteNumber: 'ORC-2026-001', customer: { id: 'customer-1', name: customerFixture.name },
  status: 'SENT', expired: true, totalCents: 123456, createdAt: '2026-10-01T12:00:00.000Z',
  validUntil: '2026-10-02T12:00:00.000Z', scheduledInstallationAt: null,
}]
