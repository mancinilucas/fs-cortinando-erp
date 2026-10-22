import { useQuery } from '@tanstack/react-query'
import { searchQuotes } from './api'
import { quoteKeys } from './query-keys'
import type { QuoteSearch } from './types'

export function useQuotes(filters: QuoteSearch) {
  return useQuery({ queryKey: quoteKeys.list(filters), queryFn: ({ signal }) => searchQuotes(filters, signal) })
}
