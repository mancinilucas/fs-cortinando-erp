import { ApiError } from '@/shared/api/api-error'
import { httpClient } from '@/shared/api/http-client'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { dashboardSchema } from './schema'
import type { Dashboard } from './types'

function decodeDashboard(value: unknown): Dashboard {
  const result = dashboardSchema.safeParse(value)
  if (!result.success) throw new ApiError(200, { messages: [GENERIC_ERROR_MESSAGE], violations: [] })
  return result.data
}

export async function getDashboard(signal?: AbortSignal): Promise<Dashboard> {
  const data = await httpClient.json('/dashboard', { signal, decode: decodeDashboard })
  if (!data) throw new ApiError(204, { messages: [GENERIC_ERROR_MESSAGE], violations: [] })
  return data
}
