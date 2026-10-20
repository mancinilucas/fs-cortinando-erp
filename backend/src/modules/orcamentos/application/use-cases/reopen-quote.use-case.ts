import { Injectable } from '@nestjs/common';
import { Quote } from '../../domain/entities/quote.js';
import { QuoteHistoryDetails } from '../../domain/history/quote-history.js';
import { QuoteRepository } from '../../domain/repositories/quote.repository.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';

export interface ReopenQuoteInput {
  id: string;
}

/**
 * CONFIRMED -> SENT (D100). The aggregate clears the confirmation and the
 * installation schedule while preserving firstSentAt and validUntil; the
 * cleared values are recorded in QUOTE_REOPENED in the same transaction.
 */
@Injectable()
export class ReopenQuoteUseCase {
  constructor(private readonly quotes: QuoteRepository) {}

  async execute(input: ReopenQuoteInput): Promise<Quote> {
    const quote = await this.quotes.mutate(input.id, (quote) => {
      const previous = quote.reopen();

      return {
        type: 'QUOTE_REOPENED',
        details: QuoteHistoryDetails.reopened(
          previous.previousConfirmedAt,
          previous.previousScheduledInstallationAt,
        ),
      };
    });

    if (quote === null) {
      throw new QuoteNotFoundError();
    }

    return quote;
  }
}
