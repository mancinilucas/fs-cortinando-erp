import { Injectable } from '@nestjs/common';
import {
  QuoteSearchQueryRepository,
  type QuoteSearchStatus,
  type QuoteSummaryView,
} from '../ports/quote-search-query.repository.js';
import { Clock } from '../ports/clock.port.js';

export interface SearchQuotesInput {
  search?: string | null;
  status?: QuoteSearchStatus | null;
}

/**
 * Quote search/list projection (D113). Only `search` and `status` are
 * supported in the MVP; there are no date-range filters and no pagination.
 */
@Injectable()
export class SearchQuotesQuery {
  constructor(
    private readonly quotes: QuoteSearchQueryRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SearchQuotesInput = {}): Promise<QuoteSummaryView[]> {
    const search = input.search?.trim() ?? '';

    return this.quotes.search(
      {
        search: search === '' ? undefined : search,
        status: input.status ?? undefined,
      },
      this.clock.now(),
    );
  }
}
