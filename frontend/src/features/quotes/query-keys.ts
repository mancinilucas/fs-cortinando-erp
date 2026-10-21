import type { QuoteSearch } from './types'

export const quoteKeys = {
  all: ['quotes'] as const,
  lists: () => ['quotes', 'list'] as const,
  list: ({ search = '', status }: QuoteSearch = {}) => ['quotes', 'list', search, status ?? null] as const,
  detail: (id: string | undefined) => ['quotes', 'detail', id] as const,
  history: (id: string | undefined) => ['quotes', 'history', id] as const,
}
// Customer quote history uses customerKeys.history; PDFs are never cached as queries.
