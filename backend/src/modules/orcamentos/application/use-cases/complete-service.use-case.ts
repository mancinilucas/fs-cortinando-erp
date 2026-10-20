import { Injectable } from '@nestjs/common';
import { Quote } from '../../domain/entities/quote.js';
import { QuoteRepository } from '../../domain/repositories/quote.repository.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { Clock } from '../ports/clock.port.js';

export interface CompleteServiceInput {
  id: string;
}

/**
 * IN_PRODUCTION -> COMPLETED (D105). Completion is blocked while a scheduled
 * installation lies in the future; it does not require an installation.
 */
@Injectable()
export class CompleteServiceUseCase {
  constructor(
    private readonly quotes: QuoteRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CompleteServiceInput): Promise<Quote> {
    const quote = await this.quotes.findById(input.id);

    if (quote === null) {
      throw new QuoteNotFoundError();
    }

    quote.complete(this.clock.now());

    await this.quotes.save(quote, { type: 'SERVICE_COMPLETED' });

    return quote;
  }
}
