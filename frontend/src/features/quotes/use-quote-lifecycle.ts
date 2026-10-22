import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/shared/api/api-error'
import { customerKeys } from '@/features/customers/query-keys'
import { dashboardQueryKey } from '@/features/dashboard/use-dashboard'
import * as api from './api'
import { useQuoteCache } from './hooks'
import { quoteKeys } from './query-keys'
import type { LifecycleAction } from './lifecycle'
import type { QuoteDetail } from './types'

export function useQuoteLifecycle(quote: QuoteDetail) {
  const client = useQueryClient()
  const refresh = useQuoteCache()
  return useMutation({ mutationFn: async ({ action, validUntil, reason }: { action: LifecycleAction; validUntil?: string; reason?: string }): Promise<QuoteDetail | void> => {
    switch (action) {
      case 'send': return api.sendQuote(quote.id, validUntil ? { validUntil } : {})
      case 'confirm': return api.confirmQuote(quote.id)
      case 'reopen': return api.reopenQuote(quote.id)
      case 'renew': if (!validUntil) throw new TypeError('Validity is required'); return api.renewQuote(quote.id, { validUntil })
      case 'cancel': return api.cancelQuote(quote.id, reason ? { reason } : {})
      case 'startProduction': return api.startQuoteProduction(quote.id)
      case 'complete': return api.completeQuote(quote.id)
      case 'delete': return api.deleteQuote(quote.id)
    }
  }, onSuccess: async (saved, variables) => {
    if (saved) { await refresh(saved); return }
    if (variables.action !== 'delete') return
    const detail = quoteKeys.detail(quote.id); const history = quoteKeys.history(quote.id)
    const dependents = [quoteKeys.lists(), customerKeys.history(quote.customerId), dashboardQueryKey]
    await Promise.all([detail, history, ...dependents].map((queryKey) => client.cancelQueries({ queryKey })))
    client.removeQueries({ queryKey: detail }); client.removeQueries({ queryKey: history })
    await Promise.all(dependents.map((queryKey) => client.invalidateQueries({ queryKey })))
  }, onError: async (error) => {
    if (error instanceof ApiError && error.status === 409) {
      await client.cancelQueries({ queryKey: quoteKeys.detail(quote.id) })
      await Promise.all([quoteKeys.detail(quote.id), quoteKeys.history(quote.id)].map((queryKey) => client.invalidateQueries({ queryKey })))
    }
  } })
}
