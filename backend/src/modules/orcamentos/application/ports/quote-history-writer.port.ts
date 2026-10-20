import type { QuoteHistoryEventDraft } from '../../domain/history/quote-history.js';

// Append-only write port for quote history (D183). Document generation must
// not go through QuoteRepository.save/mutate, which updates the quote and
// reconciles its children (D144/D177).
export abstract class QuoteHistoryWriter {
  abstract append(input: {
    quoteId: string;
    event: QuoteHistoryEventDraft;
    occurredAt: Date;
  }): Promise<void>;
}
