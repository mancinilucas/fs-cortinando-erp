import { z } from 'zod'
import { httpClient } from '@/shared/api/http-client'
import { ApiError } from '@/shared/api/api-error'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { createCustomerSchema, updateCustomerSchema, customerDetailSchema, customerSummarySchema, customerQuoteSchema } from './schema'
import type { CreateCustomerPayload, UpdateCustomerPayload } from './types'

async function read<T>(path: string, schema: z.ZodType<T>, options: { method?: 'POST' | 'PATCH'; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const result = await httpClient.json(path, { ...options, decode: (value) => {
    const parsed = schema.safeParse(value)
    if (!parsed.success) throw new ApiError(200, { messages: [GENERIC_ERROR_MESSAGE], violations: [] })
    return parsed.data
  } })
  if (result === undefined) throw new ApiError(204, { messages: [GENERIC_ERROR_MESSAGE], violations: [] })
  return result
}
function customerPath(id: string) {
  if (!id || id === '.' || id === '..') throw new TypeError('Customer ID is required')
  return `/clientes/${encodeURIComponent(id)}`
}

export function searchCustomers(search = '', signal?: AbortSignal) {
  const query = new URLSearchParams({ search })
  return read(`/clientes?${query}`, z.array(customerSummarySchema), { signal })
}
export function getCustomer(id: string, signal?: AbortSignal) {
  return read(customerPath(id), customerDetailSchema, { signal })
}
export function getCustomerQuotes(id: string, signal?: AbortSignal) {
  return read(`${customerPath(id)}/orcamentos`, z.array(customerQuoteSchema), { signal })
}
export function createCustomer(payload: CreateCustomerPayload, signal?: AbortSignal) {
  return read('/clientes', customerDetailSchema, { method: 'POST', body: createCustomerSchema.parse(payload), signal })
}
export function updateCustomer(id: string, payload: UpdateCustomerPayload, signal?: AbortSignal) {
  return read(customerPath(id), customerDetailSchema, { method: 'PATCH', body: updateCustomerSchema.parse(payload), signal })
}
export async function deleteCustomer(id: string, signal?: AbortSignal): Promise<void> {
  const result = await httpClient.json(customerPath(id), { method: 'DELETE', signal })
  if (result !== undefined) throw new TypeError('Customer deletion response must have no body')
}
