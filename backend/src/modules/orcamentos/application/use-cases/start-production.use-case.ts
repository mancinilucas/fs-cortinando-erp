import { Injectable } from '@nestjs/common';
import { Quote } from '../../domain/entities/quote.js';
import { QuoteRepository } from '../../domain/repositories/quote.repository.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { Clock } from '../ports/clock.port.js';

export interface StartProductionInput {
  id: string;
}

/**
 * CONFIRMED -> IN_PRODUCTION (D96). There is no ProductionOrder aggregate or
 * redundant gate; the aggregate records productionStartedAt and the
 * application writes PRODUCTION_STARTED in the same transaction.
 */
@Injectable()
export class StartProductionUseCase {
  constructor(
    private readonly quotes: QuoteRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: StartProductionInput): Promise<Quote> {
    const quote = await this.quotes.mutate(input.id, (quote) => {
      quote.startProduction(this.clock.now());

      return { type: 'PRODUCTION_STARTED' };
    });

    if (quote === null) {
      throw new QuoteNotFoundError();
    }

    return quote;
  }
}
