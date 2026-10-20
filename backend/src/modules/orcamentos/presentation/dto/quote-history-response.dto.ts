import type { QuoteHistoryReadEventType } from '../../application/ports/quote-history-query.repository.js';

// Public history response (D108/D113/D116). `details` is the persisted JSON
// contract defined by D109 and stays opaque to the response type.
export class QuoteHistoryResponseDto {
  id: string;
  eventType: QuoteHistoryReadEventType;
  occurredAt: string;
  details: unknown;
}
