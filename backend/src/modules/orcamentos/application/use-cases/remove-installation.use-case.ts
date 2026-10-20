import { Injectable } from '@nestjs/common';
import { Quote } from '../../domain/entities/quote.js';
import { QuoteHistoryDetails } from '../../domain/history/quote-history.js';
import { QuoteRepository } from '../../domain/repositories/quote.repository.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';

export interface RemoveInstallationInput {
  id: string;
}

/**
 * DELETE installation (D104). Allowed in CONFIRMED and IN_PRODUCTION. The
 * previous instant is recorded in INSTALLATION_REMOVED; removing an absent
 * schedule is a no-op with no history.
 */
@Injectable()
export class RemoveInstallationUseCase {
  constructor(private readonly quotes: QuoteRepository) {}

  async execute(input: RemoveInstallationInput): Promise<Quote> {
    const quote = await this.quotes.findById(input.id);

    if (quote === null) {
      throw new QuoteNotFoundError();
    }

    const previous = quote.removeScheduledInstallation();

    if (previous === null) {
      return quote;
    }

    await this.quotes.save(quote, {
      type: 'INSTALLATION_REMOVED',
      details: QuoteHistoryDetails.installationRemoved(previous),
    });

    return quote;
  }
}
