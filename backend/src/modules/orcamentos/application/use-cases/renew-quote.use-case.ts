import { Injectable } from '@nestjs/common';
import { Quote } from '../../domain/entities/quote.js';
import { QuoteHistoryDetails } from '../../domain/history/quote-history.js';
import { QuoteRepository } from '../../domain/repositories/quote.repository.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { Clock } from '../ports/clock.port.js';

export interface RenewQuoteInput {
  id: string;
  validUntil: Date;
}

/**
 * Renews the validity of a SENT quote, valid or expired, keeping the status,
 * number and firstSentAt (D99). The new validity is strictly in the future;
 * QUOTE_RENEWED records both the previous and the applied validity.
 */
@Injectable()
export class RenewQuoteUseCase {
  constructor(
    private readonly quotes: QuoteRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RenewQuoteInput): Promise<Quote> {
    const quote = await this.quotes.findById(input.id);

    if (quote === null) {
      throw new QuoteNotFoundError();
    }

    const previousValidUntil = quote.renew(input.validUntil, this.clock.now());

    await this.quotes.save(quote, {
      type: 'QUOTE_RENEWED',
      details: QuoteHistoryDetails.renewed(
        previousValidUntil,
        input.validUntil,
      ),
    });

    return quote;
  }
}
