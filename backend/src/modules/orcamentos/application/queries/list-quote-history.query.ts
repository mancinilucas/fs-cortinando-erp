import { Injectable } from '@nestjs/common';
import {
  QuoteHistoryQueryRepository,
  type QuoteHistoryEntry,
} from '../ports/quote-history-query.repository.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';

export interface ListQuoteHistoryInput {
  id: string;
}

/**
 * Chronological quote history (D113). The read repository orders by
 * occurredAt ASC, id ASC and returns every recorded event with its details.
 */
@Injectable()
export class ListQuoteHistoryQuery {
  constructor(private readonly history: QuoteHistoryQueryRepository) {}

  async execute(input: ListQuoteHistoryInput): Promise<QuoteHistoryEntry[]> {
    const entries = await this.history.listByQuoteId(input.id);

    if (entries === null) {
      throw new QuoteNotFoundError();
    }

    return entries;
  }
}
