import { z } from 'zod'
import { httpClient } from '@/shared/api/http-client'
import type { HttpOptions } from '@/shared/api/http-client'
import { ApiError } from '@/shared/api/api-error'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import * as schemas from './schema'
import type { CancelQuotePayload, CreateQuotePayload, QuoteDocument, QuoteSearch, RenewQuotePayload, ScheduleInstallationPayload, SendQuotePayload, UpdateQuotePayload } from './types'

function resourcePath(resource: 'clientes' | 'orcamentos', id: string) {
  if (!id || id === '.' || id === '..') throw new TypeError('Resource ID is required')
  return `/${resource}/${encodeURIComponent(id)}`
}
const quotePath = (id: string) => resourcePath('orcamentos', id)
function invalidResponse(status: number) {
  return new ApiError(status, { messages: [GENERIC_ERROR_MESSAGE], violations: [] })
}
async function read<T>(path: string, schema: z.ZodType<T>, options: HttpOptions = {}): Promise<T> {
  const data = await httpClient.json(path, { ...options, decode: (value) => {
    const result = schema.safeParse(value)
    if (!result.success) throw invalidResponse(200)
    return result.data
  } })
  if (data === undefined) throw invalidResponse(204)
  return data
}
async function remove(path: string, signal?: AbortSignal): Promise<void> {
  const data = await httpClient.json(path, { method: 'DELETE', signal })
  if (data !== undefined) throw invalidResponse(200)
}
export function searchQuotes(filters: QuoteSearch = {}, signal?: AbortSignal) {
  const { search, status } = schemas.quoteSearchSchema.parse(filters)
  const query = new URLSearchParams()
  if (search !== undefined) query.set('search', search)
  if (status !== undefined) query.set('status', status)
  return read(`/orcamentos${query.size ? `?${query}` : ''}`, z.array(schemas.quoteSummarySchema), { signal })
}
export function getQuote(id: string, signal?: AbortSignal) {
  return read(quotePath(id), schemas.quoteDetailSchema, { signal })
}
export function getQuoteHistory(id: string, signal?: AbortSignal) {
  return read(`${quotePath(id)}/historico`, z.array(schemas.quoteHistorySchema), { signal })
}
export function createQuote(customerId: string, payload: CreateQuotePayload = {}, signal?: AbortSignal) {
  return read(`${resourcePath('clientes', customerId)}/orcamentos`, schemas.quoteDetailSchema, { method: 'POST', body: schemas.createQuoteSchema.parse(payload), signal })
}
export function updateQuote(id: string, payload: UpdateQuotePayload, signal?: AbortSignal) {
  return read(quotePath(id), schemas.quoteDetailSchema, { method: 'PATCH', body: schemas.updateQuoteSchema.parse(payload), signal })
}
export function deleteQuote(id: string, signal?: AbortSignal) { return remove(quotePath(id), signal) }
function action(id: string, name: string, body: unknown, signal?: AbortSignal) {
  return read(`${quotePath(id)}/${name}`, schemas.quoteDetailSchema, { method: 'POST', body, signal })
}
export function sendQuote(id: string, payload: SendQuotePayload = {}, signal?: AbortSignal) {
  return action(id, 'enviar', schemas.sendQuoteSchema.parse(payload), signal)
}
export function confirmQuote(id: string, signal?: AbortSignal) { return action(id, 'confirmar', undefined, signal) }
export function reopenQuote(id: string, signal?: AbortSignal) { return action(id, 'reabrir', undefined, signal) }
export function renewQuote(id: string, payload: RenewQuotePayload, signal?: AbortSignal) {
  return action(id, 'renovar', schemas.renewQuoteSchema.parse(payload), signal)
}
export function cancelQuote(id: string, payload: CancelQuotePayload = {}, signal?: AbortSignal) {
  return action(id, 'cancelar', schemas.cancelQuoteSchema.parse(payload), signal)
}
export function startQuoteProduction(id: string, signal?: AbortSignal) { return action(id, 'iniciar-producao', undefined, signal) }
export function completeQuote(id: string, signal?: AbortSignal) { return action(id, 'concluir', undefined, signal) }
export function scheduleInstallation(id: string, payload: ScheduleInstallationPayload, signal?: AbortSignal) {
  return read(`${quotePath(id)}/instalacao`, schemas.quoteDetailSchema, { method: 'PUT', body: schemas.scheduleInstallationSchema.parse(payload), signal })
}
export function removeInstallation(id: string, signal?: AbortSignal) { return remove(`${quotePath(id)}/instalacao`, signal) }
async function document(id: string, name: 'pdf' | 'ordem-producao', signal?: AbortSignal): Promise<QuoteDocument> {
  const data = await httpClient.blob(`${quotePath(id)}/${name}`, { signal })
  if (!data || data.type.split(';')[0].trim().toLowerCase() !== 'application/pdf') throw invalidResponse(200)
  return data
}
export function getCommercialPdf(id: string, signal?: AbortSignal) { return document(id, 'pdf', signal) }
export function getProductionOrder(id: string, signal?: AbortSignal) { return document(id, 'ordem-producao', signal) }
