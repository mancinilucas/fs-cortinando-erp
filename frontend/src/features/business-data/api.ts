import { ApiError } from '@/shared/api/api-error'
import { httpClient } from '@/shared/api/http-client'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { businessDataSchema } from './schema'
import type { BusinessData, BusinessDataPayload } from './types'

function decodeBusinessData(value: unknown): BusinessData {
  const parsed = businessDataSchema.safeParse(value)
  if (!parsed.success) throw new ApiError(200, { messages: [GENERIC_ERROR_MESSAGE], violations: [] })
  return parsed.data
}

export async function getBusinessData(signal?: AbortSignal): Promise<BusinessData> {
  const data = await httpClient.json('/dados-do-negocio', { signal, decode: decodeBusinessData })
  if (!data) throw new ApiError(204, { messages: [GENERIC_ERROR_MESSAGE], violations: [] })
  return data
}

export async function updateBusinessData(payload: BusinessDataPayload): Promise<BusinessData> {
  const data = await httpClient.json('/dados-do-negocio', { method: 'PUT', body: payload, decode: decodeBusinessData })
  if (!data) throw new ApiError(204, { messages: [GENERIC_ERROR_MESSAGE], violations: [] })
  return data
}
