import { apiBaseUrl, readApiBaseUrl } from '@/shared/config/env'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { parseApiError } from '@/shared/errors/parse-api-error'
import { ApiError } from './api-error'

export type HttpOptions = {
  method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

type Decoder<T> = (value: unknown) => T

function normalizeBaseUrl(value: string): string {
  const base = readApiBaseUrl(value)
  if (!base) return ''
  if (base.includes('\\') || base.startsWith('//')) throw new TypeError('Invalid API base URL')
  const url = new URL(base, 'http://base.invalid')
  if ((!base.startsWith('/') && !/^https?:\/\//i.test(base)) || url.username || url.password || url.search || url.hash) {
    throw new TypeError('API base must be an HTTP URL or root-relative path without credentials, query or fragment')
  }
  return base
}

async function readJson(response: Response, signal: AbortSignal | undefined, tolerateInvalid: boolean): Promise<unknown> {
  try {
    const value: unknown = await response.json()
    return value
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error
    if (tolerateInvalid) return undefined
    throw new ApiError(response.status, { messages: [GENERIC_ERROR_MESSAGE], violations: [] })
  }
}

export function createHttpClient(baseUrl = apiBaseUrl) {
  const base = normalizeBaseUrl(baseUrl)

  async function send(path: string, options: HttpOptions, accept: string): Promise<Response> {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.includes('#')) {
      throw new TypeError('API path must be root-relative without a fragment')
    }
    const method = options.method ?? 'GET'
    if (options.body !== undefined && (method === 'GET' || method === 'HEAD')) {
      throw new TypeError('GET and HEAD cannot have a request body')
    }
    const headers = new Headers({ Accept: accept })
    let body: string | undefined
    if (options.body !== undefined) {
      body = JSON.stringify(options.body)
      if (body === undefined) throw new TypeError('Request body must be JSON serializable')
      headers.set('Content-Type', 'application/json')
    }

    const response = await fetch(`${base}${path}`, {
      method, headers, body, credentials: 'include', signal: options.signal,
    })
    if (!response.ok) {
      const payload = await readJson(response, options.signal, true)
      throw new ApiError(response.status, parseApiError(response.status, payload))
    }
    return response
  }

  function json<T>(path: string, options: HttpOptions & { decode: Decoder<T> }): Promise<T | undefined>
  function json(path: string, options?: HttpOptions): Promise<unknown>
  async function json(path: string, options: HttpOptions & { decode?: Decoder<unknown> } = {}): Promise<unknown> {
    const response = await send(path, options, 'application/json')
    if (response.status === 204 || options.method === 'HEAD') return undefined
    const value = await readJson(response, options.signal, false)
    return options.decode ? options.decode(value) : value
  }

  async function blob(path: string, options: HttpOptions = {}): Promise<Blob | undefined> {
    const response = await send(path, options, 'application/pdf')
    if (response.status === 204 || options.method === 'HEAD') return undefined
    return response.blob()
  }

  return { json, blob }
}

export const httpClient = createHttpClient()
