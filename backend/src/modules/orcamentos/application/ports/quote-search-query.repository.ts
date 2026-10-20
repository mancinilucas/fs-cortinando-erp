import type { QuoteStatus } from '../../domain/entities/quote.js';

// Search/list read port (D113). The summary projection is computed directly in
// SQL, including totalCents, so no aggregate is rebuilt for listings.

// EXPIRED is virtual and never persisted (D106).
export type QuoteSearchStatus = QuoteStatus | 'EXPIRED';

export interface QuoteSearchFilter {
  search?: string;
  status?: QuoteSearchStatus;
}

export interface QuoteSummaryView {
  id: string;
  quoteNumber: string;
  customer: { id: string; name: string };
  status: QuoteStatus;
  expired: boolean;
  totalCents: number;
  createdAt: Date;
  validUntil: Date | null;
  scheduledInstallationAt: Date | null;
}

export abstract class QuoteSearchQueryRepository {
  /** Results are ordered by createdAt DESC, id DESC (D113). */
  abstract search(
    filter: QuoteSearchFilter,
    now: Date,
  ): Promise<QuoteSummaryView[]>;
}
