import { Injectable } from '@nestjs/common';
import { Quote } from '../../domain/entities/quote.js';
import { QuoteValidationError } from '../../domain/errors/quote-domain.errors.js';
import { QuoteHistoryDetails } from '../../domain/history/quote-history.js';
import { QuoteRepository } from '../../domain/repositories/quote.repository.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { Clock } from '../ports/clock.port.js';
import { CustomerEligibility } from '../ports/customer-eligibility.port.js';

export interface MarkQuoteAsSentInput {
  id: string;
  validUntil?: Date | null;
}

/**
 * DRAFT -> SENT (D96). The customer must still exist and be active (D97); the
 * aggregate performs the remaining gate and computes the final validity
 * (D98). The state change and QUOTE_SENT are persisted in one transaction
 * (D119).
 */
@Injectable()
export class MarkQuoteAsSentUseCase {
  constructor(
    private readonly quotes: QuoteRepository,
    private readonly customers: CustomerEligibility,
    private readonly clock: Clock,
  ) {}

  async execute(input: MarkQuoteAsSentInput): Promise<Quote> {
    const quote = await this.quotes.findById(input.id);

    if (quote === null) {
      throw new QuoteNotFoundError();
    }

    if (!(await this.customers.existsAndIsActive(quote.customerId))) {
      throw new QuoteValidationError([
        {
          code: 'CUSTOMER_NOT_ACTIVE',
          message: 'Customer must exist and be active',
        },
      ]);
    }

    quote.markAsSent(this.clock.now(), input.validUntil ?? null);

    const appliedValidUntil = quote.validUntil;

    if (appliedValidUntil === null) {
      throw new Error('Quote must have a validity after being sent');
    }

    await this.quotes.save(quote, {
      type: 'QUOTE_SENT',
      details: QuoteHistoryDetails.sent(appliedValidUntil),
    });

    return quote;
  }
}
