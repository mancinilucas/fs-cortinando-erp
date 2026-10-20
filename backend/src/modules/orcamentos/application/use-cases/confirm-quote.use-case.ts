import { Injectable } from '@nestjs/common';
import { Quote } from '../../domain/entities/quote.js';
import { QuoteRepository } from '../../domain/repositories/quote.repository.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { Clock } from '../ports/clock.port.js';

export interface ConfirmQuoteInput {
  id: string;
}

/**
 * SENT -> CONFIRMED (D96/D99). Expired quotes and SENT quotes without a
 * validity are blocked by the aggregate as transition conflicts. The state
 * change and QUOTE_CONFIRMED are persisted in one transaction (D119).
 */
@Injectable()
export class ConfirmQuoteUseCase {
  constructor(
    private readonly quotes: QuoteRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ConfirmQuoteInput): Promise<Quote> {
    const quote = await this.quotes.findById(input.id);

    if (quote === null) {
      throw new QuoteNotFoundError();
    }

    quote.confirm(this.clock.now());

    await this.quotes.save(quote, { type: 'QUOTE_CONFIRMED' });

    return quote;
  }
}
