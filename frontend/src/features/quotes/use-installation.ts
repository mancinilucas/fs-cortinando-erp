import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/shared/api/api-error'
import { customerKeys } from '@/features/customers/query-keys'
import { dashboardQueryKey } from '@/features/dashboard/use-dashboard'
import { scheduleInstallation, removeInstallation } from './api'
import { useQuoteCache } from './hooks'
import { quoteKeys } from './query-keys'
import type { QuoteDetail } from './types'

export type InstallationOperation = { action: 'schedule'; scheduledInstallationAt: string } | { action: 'remove' }
export function useInstallation(quote: QuoteDetail) {
  const client = useQueryClient()
  const refresh = useQuoteCache()
  return useMutation({ mutationFn: async (operation: InstallationOperation): Promise<QuoteDetail | void> => {
    if (operation.action === 'schedule') return scheduleInstallation(quote.id, { scheduledInstallationAt: operation.scheduledInstallationAt })
    return removeInstallation(quote.id)
  }, onSuccess: async (saved) => {
    if (saved) { await refresh(saved); return }
    // DELETE returns 204: refetch the detail instead of deriving a replacement locally.
    const keys = [quoteKeys.detail(quote.id), quoteKeys.history(quote.id), quoteKeys.lists(), customerKeys.history(quote.customerId), dashboardQueryKey]
    await Promise.all(keys.map((queryKey) => client.cancelQueries({ queryKey })))
    await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })))
  }, onError: async (error) => {
    if (error instanceof ApiError && error.status === 409) {
      await client.cancelQueries({ queryKey: quoteKeys.detail(quote.id) })
      await Promise.all([quoteKeys.detail(quote.id), quoteKeys.history(quote.id)].map((queryKey) => client.invalidateQueries({ queryKey })))
    }
  } })
}
