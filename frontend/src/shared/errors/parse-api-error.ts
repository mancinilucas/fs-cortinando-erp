import { GENERIC_ERROR_MESSAGE, getGateViolationMessage, getHttpErrorMessage, getKnownErrorMessage } from './error-messages'

export type ApiViolation = { readonly code: string; readonly message: string }
export type ParsedApiError = {
  readonly messages: readonly string[]
  readonly violations: readonly ApiViolation[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseApiError(status: number, payload: unknown): ParsedApiError {
  const fallback = getHttpErrorMessage(status)
  if (!isRecord(payload)) return { messages: [fallback], violations: [] }

  const rawMessage = Object.hasOwn(payload, 'message') ? payload.message : undefined
  const rawMessages: readonly unknown[] = typeof rawMessage === 'string' ? [rawMessage] : Array.isArray(rawMessage) ? rawMessage : []
  const messages = rawMessages.filter((value): value is string => typeof value === 'string').map((value) => {
    const translated = getKnownErrorMessage(value)
    return translated === GENERIC_ERROR_MESSAGE ? fallback : translated
  })

  const violations: ApiViolation[] = []
  const errors = Object.hasOwn(payload, 'errors') ? payload.errors : undefined
  const rawErrors: readonly unknown[] = Array.isArray(errors) ? errors : []
  for (const error of rawErrors) {
    if (isRecord(error) && Object.hasOwn(error, 'code') && typeof error.code === 'string' && /^[A-Z][A-Z0-9_]*$/.test(error.code)) {
      violations.push({ code: error.code, message: getGateViolationMessage(error.code) })
    }
  }

  return { messages: [...new Set(messages.length ? messages : [fallback])], violations }
}
