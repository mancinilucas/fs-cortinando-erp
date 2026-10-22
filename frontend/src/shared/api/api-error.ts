import type { ApiViolation, ParsedApiError } from '@/shared/errors/parse-api-error'
import { getHttpErrorMessage } from '@/shared/errors/error-messages'

export class ApiError extends Error {
  readonly status: number
  readonly messages: readonly string[]
  readonly violations: readonly ApiViolation[]

  constructor(status: number, parsed: ParsedApiError) {
    super(parsed.messages[0] ?? getHttpErrorMessage(status))
    this.name = 'ApiError'
    this.status = status
    this.messages = parsed.messages
    this.violations = parsed.violations
  }
}
