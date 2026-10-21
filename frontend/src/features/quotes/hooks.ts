import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/shared/api/api-error'
import { customerKeys } from '@/features/customers/query-keys'
import { dashboardQueryKey } from '@/features/dashboard/use-dashboard'
import { createQuote, getQuote, updateQuote } from './api'
import { quoteKeys } from './query-keys'
import type { CreateQuotePayload, QuoteDetail, UpdateQuotePayload } from './types'

export function useQuote(id: string | undefined) {
  return useQuery({ queryKey: quoteKeys.detail(id), enabled: Boolean(id), queryFn: ({ signal }) => {
    if (!id) throw new TypeError('Quote ID is required')
    return getQuote(id, signal)
  } })
}
function useQuoteCache() {
  const client = useQueryClient()
  return async (quote: QuoteDetail) => {
    const detail = quoteKeys.detail(quote.id)
    const dependents = [quoteKeys.lists(), quoteKeys.history(quote.id), customerKeys.history(quote.customerId), dashboardQueryKey]
    const keys = [detail, ...dependents]
    await Promise.all(keys.map((queryKey) => client.cancelQueries({ queryKey })))
    client.setQueryData(quoteKeys.detail(quote.id), quote)
    await Promise.all([client.invalidateQueries({ queryKey: detail, refetchType: 'none' }),
      ...dependents.map((queryKey) => client.invalidateQueries({ queryKey }))])
  }
}
export function useCreateQuote(customerId: string) {
  const refresh = useQuoteCache()
  return useMutation({ mutationFn: (payload: CreateQuotePayload) => createQuote(customerId, payload), onSuccess: refresh })
}
export function useUpdateQuote(id: string) {
  const refresh = useQuoteCache()
  const client = useQueryClient()
  return useMutation({ mutationFn: (payload: UpdateQuotePayload) => updateQuote(id, payload), onSuccess: refresh,
    onError: async (error) => {
      if (error instanceof ApiError && error.status === 409) {
        await client.cancelQueries({ queryKey: quoteKeys.detail(id) })
        await client.invalidateQueries({ queryKey: quoteKeys.detail(id) })
      }
    },
  })
}
