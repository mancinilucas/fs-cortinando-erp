import { ApiError } from '@/shared/api/api-error'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardQueryKey } from '@/features/dashboard/use-dashboard'
import { createCustomer, deleteCustomer, getCustomer, getCustomerQuotes, searchCustomers, updateCustomer } from './api'
import { customerKeys, quoteSummariesQueryKey } from './query-keys'
import type { CustomerDetail, CreateCustomerPayload, UpdateCustomerPayload } from './types'

export function useCustomers(search = '') {
  return useQuery({ queryKey: customerKeys.list(search), queryFn: ({ signal }) => searchCustomers(search, signal) })
}
export function useCustomer(id: string | undefined) {
  return useQuery({ queryKey: customerKeys.detail(id), enabled: Boolean(id), queryFn: ({ signal }) => {
    if (!id) throw new TypeError('Customer ID is required')
    return getCustomer(id, signal)
  } })
}
export function useCustomerQuotes(id: string | undefined) {
  return useQuery({ queryKey: customerKeys.history(id), enabled: Boolean(id), queryFn: ({ signal }) => {
    if (!id) throw new TypeError('Customer ID is required')
    return getCustomerQuotes(id, signal)
  } })
}

function useCustomerCache() {
  const client = useQueryClient()
  return async (customer?: CustomerDetail) => {
    // Discard stale in-flight reads before storing the server's current detail.
    await Promise.all([
      client.cancelQueries({ queryKey: customerKeys.all }),
      client.cancelQueries({ queryKey: quoteSummariesQueryKey }),
      client.cancelQueries({ queryKey: dashboardQueryKey }),
    ])
    if (customer) client.setQueryData(customerKeys.detail(customer.id), customer)
    await Promise.all([
      client.invalidateQueries({ queryKey: customerKeys.all }),
      client.invalidateQueries({ queryKey: quoteSummariesQueryKey }),
      client.invalidateQueries({ queryKey: dashboardQueryKey }),
    ])
  }
}
export function useCreateCustomer() {
  const refresh = useCustomerCache()
  return useMutation({ mutationFn: (payload: CreateCustomerPayload) => createCustomer(payload), onSuccess: (customer) => refresh(customer) })
}
export function useUpdateCustomer(id: string) {
  const refresh = useCustomerCache()
  return useMutation({ mutationFn: (payload: UpdateCustomerPayload) => updateCustomer(id, payload), onSuccess: (customer) => refresh(customer) })
}
export function useDeleteCustomer() {
  const client = useQueryClient()
  const refresh = useCustomerCache()
  return useMutation({ mutationFn: async (id: string) => {
    try { await deleteCustomer(id) } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error
    }
  }, onSuccess: async (_data, id) => {
    await client.cancelQueries({ queryKey: customerKeys.detail(id) })
    await client.cancelQueries({ queryKey: customerKeys.history(id) })
    client.removeQueries({ queryKey: customerKeys.detail(id) })
    client.removeQueries({ queryKey: customerKeys.history(id) })
    await refresh()
  } })
}
