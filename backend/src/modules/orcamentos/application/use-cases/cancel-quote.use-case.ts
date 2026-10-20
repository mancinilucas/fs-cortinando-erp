import { Injectable } from '@nestjs/common';
import { Quote } from '../../domain/entities/quote.js';
import { QuoteHistoryDetails } from '../../domain/history/quote-history.js';
import { QuoteRepository } from '../../domain/repositories/quote.repository.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';

export interface CancelQuoteInput {
  id: string;
  reason?: string | null;
}

/**
 * Cancels a quote while the state machine allows it, up to CONFIRMED (D96).
 * The optional reason is normalized by the aggregate and recorded only in
 * QUOTE_CANCELLED.details; there is no dedicated column.
 */
@Injectable()
export class CancelQuoteUseCase {
  constructor(private readonly quotes: QuoteRepository) {}

  async execute(input: CancelQuoteInput): Promise<Quote> {
    const quote = await this.quotes.mutate(input.id, (quote) => {
      const reason = quote.cancel(input.reason);

      return {
        type: 'QUOTE_CANCELLED',
        details: QuoteHistoryDetails.cancelled(reason),
      };
    });

    if (quote === null) {
      throw new QuoteNotFoundError();
    }

    return quote;
  }
}
