import type { Quote } from '../entities/quote.js';
import type { QuoteHistoryEventDraft } from '../history/quote-history.js';
import type { QuoteNumber } from '../value-objects/quote-number.js';

// Aggregate Root persistence port (D112). There is no repository for Curtain
// or FinancialItem: the aggregate persists and reconciles its children.
// History is not loaded with the aggregate, but it is written atomically with
// the state change (D108/D119), hence the event parameter.

export interface QuoteCreation {
  quote: Quote;
  event: QuoteHistoryEventDraft;
}

/**
 * Operation applied to an aggregate loaded inside the write transaction.
 * Returning null means the operation produced no state change, so nothing is
 * persisted and no history is written (e.g. an unchanging installation date).
 */
export type QuoteMutation = (quote: Quote) => QuoteHistoryEventDraft | null;

export abstract class QuoteRepository {
  /** Loads the complete aggregate, including terminal statuses. */
  abstract findById(id: string): Promise<Quote | null>;

  /**
   * Reserves the annual number and persists the aggregate, its children and
   * the creation event in one transaction. `build` runs after the reservation
   * so the aggregate receives the reserved number; if it throws, the
   * reservation is rolled back with the rest of the transaction.
   */
  abstract create(
    year: number,
    build: (quoteNumber: QuoteNumber) => QuoteCreation,
  ): Promise<Quote>;

  /**
   * Persists the aggregate, reconciles its children and inserts the single
   * event produced by the mutation in one transaction.
   */
  abstract save(quote: Quote, event: QuoteHistoryEventDraft): Promise<void>;

  /**
   * Loads the aggregate inside a transaction, hands it to `operation`, and
   * persists the resulting state, its children and the event atomically
   * (D119). The write is conditional on the status observed on load, so a
   * concurrent action cannot be overwritten (D120); a status change makes the
   * mutation fail with a transition conflict instead of persisting stale
   * state. Returns null when the quote no longer exists.
   */
  abstract mutate(id: string, operation: QuoteMutation): Promise<Quote | null>;

  /** Deletes a DRAFT physically. Returns false when it no longer exists. */
  abstract deleteDraft(id: string): Promise<boolean>;
}
