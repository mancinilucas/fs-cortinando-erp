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
    const quote = await this.quotes.mutate(input.id, (quote) => {
      const previous = quote.scheduledInstallationAt;
      const action = quote.setScheduledInstallation(
        input.scheduledInstallationAt,
      );

      if (action === 'UNCHANGED') {
        return null;
      }

      if (action === 'SCHEDULED') {
        return {
          type: 'INSTALLATION_SCHEDULED',
          details: QuoteHistoryDetails.installationScheduled(
            input.scheduledInstallationAt,
          ),
        };
      }

      if (previous === null) {
        throw new Error('Changed installation must have a previous value');
      }

      return {
        type: 'INSTALLATION_CHANGED',
        details: QuoteHistoryDetails.installationChanged(
          previous,
          input.scheduledInstallationAt,
        ),
      };
    });

    if (quote === null) {
      throw new QuoteNotFoundError();
    }

    return quote;
  }
}
