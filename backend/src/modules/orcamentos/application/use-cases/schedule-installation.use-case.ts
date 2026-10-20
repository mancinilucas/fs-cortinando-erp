import { Injectable } from '@nestjs/common';
import { Quote } from '../../domain/entities/quote.js';
import { QuoteHistoryDetails } from '../../domain/history/quote-history.js';
import { QuoteRepository } from '../../domain/repositories/quote.repository.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';

export interface ScheduleInstallationInput {
  id: string;
  scheduledInstallationAt: Date;
}

/**
 * PUT installation (D104). Allowed in CONFIRMED and IN_PRODUCTION. A new
 * instant emits INSTALLATION_SCHEDULED; a different instant emits
 * INSTALLATION_CHANGED; an identical instant is a no-op with no history.
 */
@Injectable()
export class ScheduleInstallationUseCase {
  constructor(private readonly quotes: QuoteRepository) {}

  async execute(input: ScheduleInstallationInput): Promise<Quote> {
    const quote = await this.quotes.findById(input.id);

    if (quote === null) {
      throw new QuoteNotFoundError();
    }

    const previous = quote.scheduledInstallationAt;
    const action = quote.setScheduledInstallation(
      input.scheduledInstallationAt,
    );

    if (action === 'UNCHANGED') {
      return quote;
    }

    if (action === 'SCHEDULED') {
      await this.quotes.save(quote, {
        type: 'INSTALLATION_SCHEDULED',
        details: QuoteHistoryDetails.installationScheduled(
          input.scheduledInstallationAt,
        ),
      });

      return quote;
    }

    if (previous === null) {
      throw new Error('Changed installation must have a previous value');
    }

    await this.quotes.save(quote, {
      type: 'INSTALLATION_CHANGED',
      details: QuoteHistoryDetails.installationChanged(
        previous,
        input.scheduledInstallationAt,
      ),
    });

    return quote;
  }
}
