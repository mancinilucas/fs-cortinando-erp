import { IsIn, IsOptional, IsString } from 'class-validator';
import type { QuoteSearchStatus } from '../../application/ports/quote-search-query.repository.js';
import { QuoteStatus } from '../../domain/entities/quote.js';

// Query accepted by GET /orcamentos (D113/D116). Only `search` and `status`
// exist in the MVP: no date-range filters and no pagination. Trimming and
// blank handling belong to SearchQuotesQuery.
export const QUOTE_SEARCH_STATUSES: QuoteSearchStatus[] = [
  QuoteStatus.DRAFT,
  QuoteStatus.SENT,
  QuoteStatus.CONFIRMED,
  QuoteStatus.IN_PRODUCTION,
  QuoteStatus.COMPLETED,
  QuoteStatus.CANCELLED,
  'EXPIRED',
];

export class SearchQuotesQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(QUOTE_SEARCH_STATUSES)
  status?: QuoteSearchStatus;
}
