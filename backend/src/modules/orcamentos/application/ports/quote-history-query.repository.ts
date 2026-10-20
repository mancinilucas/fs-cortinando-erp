import type { QuoteHistoryEventType } from '../../domain/history/quote-history.js';

// Read port for the quote history (D108/D113). History is not loaded with the
// aggregate, so this projection is served by a dedicated read repository.

// All 14 persisted types exist (D108); the two Phase 8 events are readable
// even though this phase does not emit them.
export type QuoteHistoryReadEventType =
  | QuoteHistoryEventType
  | 'COMMERCIAL_PDF_GENERATED'
  | 'PRODUCTION_ORDER_GENERATED';

export interface QuoteHistoryEntry {
  id: string;
  eventType: QuoteHistoryReadEventType;
  occurredAt: Date;
  details: unknown;
}

export abstract class QuoteHistoryQueryRepository {
  /**
   * Returns the quote events ordered by occurredAt ASC, id ASC. Returns null
   * when the quote itself does not exist, which lets the query distinguish a
   * missing quote from an empty history.
   */
  abstract listByQuoteId(quoteId: string): Promise<QuoteHistoryEntry[] | null>;
}
