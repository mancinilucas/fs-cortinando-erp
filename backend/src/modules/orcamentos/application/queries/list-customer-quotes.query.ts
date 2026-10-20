import { Injectable } from '@nestjs/common';
import { QuoteCustomerNotFoundError } from '../errors/quote-customer-not-found.error.js';
import {
  QuoteSearchQueryRepository,
  type QuoteSummaryView,
} from '../ports/quote-search-query.repository.js';
import { Clock } from '../ports/clock.port.js';

/**
 * Customer quote history (D113). It is a read projection over Quote: Customer
 * does not own a quote collection, and soft-deleted customers keep their
 * history. A customer that never existed is a 404 at the HTTP boundary.
 */
@Injectable()
export class ListCustomerQuotesQuery {
  constructor(
    private readonly quotes: QuoteSearchQueryRepository,
    private readonly clock: Clock,
  ) {}

  async execute(customerId: string): Promise<QuoteSummaryView[]> {
    const quotes = await this.quotes.listByCustomerId(
      customerId,
      this.clock.now(),
    );

    if (quotes === null) {
      throw new QuoteCustomerNotFoundError();
    }

    return quotes;
  }
}
