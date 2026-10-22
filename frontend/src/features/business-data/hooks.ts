import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { updateBusinessData, getBusinessData } from './api'
import type { BusinessData } from './types'

export const businessDataQueryKey = ['business-data'] as const

export function useBusinessData() {
  return useQuery({ queryKey: businessDataQueryKey, queryFn: ({ signal }) => getBusinessData(signal), retry: false })
}

export function useUpdateBusinessData() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: updateBusinessData,
    onSuccess: async (saved: BusinessData) => {
      await client.cancelQueries({ queryKey: businessDataQueryKey })
      client.setQueryData(businessDataQueryKey, saved)
      await client.invalidateQueries({ queryKey: businessDataQueryKey })
    },
  })
}
