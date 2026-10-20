import type { QuoteStatus } from '../../domain/entities/quote.js';

// Public list response (D113/D116). It mirrors the summary projection used by
// the global search and by the customer history.
export class QuoteCustomerSummaryResponseDto {
  id: string;
  name: string;
}

export class QuoteSummaryResponseDto {
  id: string;
  quoteNumber: string;
  customer: QuoteCustomerSummaryResponseDto;
  status: QuoteStatus;
  expired: boolean;
  totalCents: number;
  createdAt: string;
  validUntil: string | null;
  scheduledInstallationAt: string | null;
}
