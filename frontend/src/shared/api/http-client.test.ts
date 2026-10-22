import { delay, http, HttpResponse } from 'msw'
import { expect, test, vi } from 'vitest'
import { server } from '@/shared/test/server'
import { getHttpErrorMessage } from '@/shared/errors/error-messages'
import { ApiError } from './api-error'
import { createHttpClient, httpClient } from './http-client'

const origin = 'https://api.example.test'
const client = createHttpClient(`${origin}/api/`)

function decodeReady(value: unknown): { ready: boolean } {
  if (typeof value !== 'object' || value === null || !('ready' in value) || typeof value.ready !== 'boolean') {
    throw new TypeError('Invalid response contract')
  }
  return { ready: value.ready }
}

test('returns JSON as unknown or through an explicit typed decoder', async () => {
  server.use(http.get(`${origin}/api/probe`, () => HttpResponse.json({ ready: true })))
  await expect(client.json('/probe')).resolves.toEqual({ ready: true })
  const decoded = await client.json('/probe', { decode: decodeReady })
  expect(decoded?.ready).toBe(true)
})

test('serializes JSON and includes cookies without supplying Origin, CSRF or auth headers', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  server.use(http.post(`${origin}/api/probe`, async ({ request }) => {
    expect(request.headers.get('content-type')).toBe('application/json')
    expect(request.headers.get('accept')).toBe('application/json')
    expect(request.headers.has('origin')).toBe(false)
    expect(request.headers.has('authorization')).toBe(false)
    expect(request.headers.has('x-csrf-token')).toBe(false)
    expect(await request.json()).toEqual({ name: 'Maria', address: null })
    return HttpResponse.json({ saved: true }, { status: 201 })
  }))
  await expect(client.json('/probe', { method: 'POST', body: { name: 'Maria', address: null } })).resolves.toEqual({ saved: true })
  expect(fetch.mock.calls[0][1]?.credentials).toBe('include')
})

test('uses relative paths by default without changing fetch options', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(HttpResponse.json({ ready: true }))
  await httpClient.json('/dashboard?search=Maria')
  expect(fetch).toHaveBeenCalledOnce()
  expect(fetch.mock.calls[0][0]).toBe('/dashboard?search=Maria')
  expect(fetch.mock.calls[0][1]?.credentials).toBe('include')
  expect(new Headers(fetch.mock.calls[0][1]?.headers).has('content-type')).toBe(false)
})

test('supports a root-relative API prefix', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(HttpResponse.json({ ready: true }))
  await createHttpClient('/api/').json('/clientes')
  expect(fetch.mock.calls[0][0]).toBe('/api/clientes')
})

test('handles 204 without parsing a body or calling a decoder', async () => {
  server.use(http.post(`${origin}/api/logout`, () => new HttpResponse(null, { status: 204 })))
  const decode = vi.fn(decodeReady)
  await expect(client.json('/logout', { method: 'POST', decode })).resolves.toBeUndefined()
  await expect(client.blob('/logout', { method: 'POST' })).resolves.toBeUndefined()
  expect(decode).not.toHaveBeenCalled()
})

test.each([400, 401, 403, 404, 409, 422, 429, 500])('rejects HTTP %s once with a safe ApiError and no navigation', async (status) => {
  let calls = 0
  const before = window.location.href
  server.use(http.get(`${origin}/api/error`, () => {
    calls += 1
    return HttpResponse.json({ statusCode: 999, message: 'Internal stack with private data' }, { status })
  }))
  await expect(client.json('/error')).rejects.toMatchObject({ name: 'ApiError', status, message: getHttpErrorMessage(status) })
  expect(calls).toBe(1)
  expect(window.location.href).toBe(before)
})

test('translates an array-shaped 400 and gate-shaped 422', async () => {
  server.use(
    http.get(`${origin}/api/validation`, () => HttpResponse.json({ message: ['Unknown field failure', 'Customer not found'] }, { status: 400 })),
    http.get(`${origin}/api/gate`, () => HttpResponse.json({ message: 'Quote does not satisfy the sending requirements', errors: [{ code: 'NO_CURTAINS', message: 'Raw text' }] }, { status: 422 })),
  )
  await expect(client.json('/validation')).rejects.toMatchObject({ messages: ['Confira os dados informados.', 'Cliente não encontrado.'] })
  await expect(client.json('/gate')).rejects.toMatchObject({ violations: [{ code: 'NO_CURTAINS', message: 'Inclua pelo menos uma cortina.' }] })
})

test('returns a PDF Blob and includes credentials on document requests', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  server.use(http.get(`${origin}/api/pdf`, ({ request }) => {
    expect(request.headers.get('accept')).toBe('application/pdf')
    return new HttpResponse('%PDF-1.7\nfixture', { headers: { 'content-type': 'application/pdf' } })
  }))
  const result = await client.blob('/pdf')
  expect(fetch.mock.calls[0][1]?.credentials).toBe('include')
  expect(result?.type).toBe('application/pdf')
  expect(result?.size).toBe(16)
  expect(await result?.text()).toBe('%PDF-1.7\nfixture')
})

test.each([409, 500])('parses JSON document errors before attempting Blob output (%s)', async (status) => {
  server.use(http.get(`${origin}/api/pdf`, () => HttpResponse.json({ message: 'Document data is incomplete' }, { status })))
  await expect(client.blob('/pdf')).rejects.toMatchObject({ status, message: 'Faltam dados para gerar o documento.' })
})

test.each([
  ['<html>internal details</html>', 'text/html'], ['{broken json', 'application/json'], ['', 'application/json'],
])('does not expose invalid HTTP error bodies %#', async (body, contentType) => {
  server.use(http.get(`${origin}/api/broken`, () => new HttpResponse(body, { status: 500, headers: { 'content-type': contentType } })))
  await expect(client.json('/broken')).rejects.toMatchObject({ status: 500, message: getHttpErrorMessage(500) })
})

test('rejects malformed successful JSON with a safe response error', async () => {
  server.use(http.get(`${origin}/api/broken`, () => new HttpResponse('<html>private</html>', { headers: { 'content-type': 'text/html' } })))
  await expect(client.json('/broken')).rejects.toBeInstanceOf(ApiError)
  await expect(client.json('/broken')).rejects.toMatchObject({ status: 200, message: getHttpErrorMessage(500) })
})

test('preserves network failures and pre-aborted signals without wrapping or retry', async () => {
  const failure = new TypeError('Network unavailable')
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(failure)
  await expect(client.json('/probe')).rejects.toBe(failure)
  expect(fetch).toHaveBeenCalledOnce()
  fetch.mockRestore()
  const controller = new AbortController()
  controller.abort()
  await expect(client.json('/probe', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
})

test('cancels an in-flight request using its AbortSignal', async () => {
  let markStarted: () => void = () => {}
  const started = new Promise<void>((resolve) => { markStarted = resolve })
  server.use(http.get(`${origin}/api/slow`, async () => { markStarted(); await delay(50); return HttpResponse.json({ ready: true }) }))
  const controller = new AbortController()
  const request = client.json('/slow', { signal: controller.signal })
  const rejected = expect(request).rejects.toMatchObject({ name: 'AbortError' })
  await started
  controller.abort()
  await rejected
})

test.each(['https://other.example.test/x', '//other.example.test/x', '/\\other.example.test/x', 'clientes', '/x#fragment'])('rejects unsafe API path %s before fetch', async (path) => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  await expect(client.json(path)).rejects.toBeInstanceOf(TypeError)
  expect(fetch).not.toHaveBeenCalled()
})

test.each(['//other.example.test', 'file:///tmp/x', 'https://user:secret@example.test', '/api?secret=x', '/api#x'])('rejects invalid base URL %s', (base) => {
  expect(() => createHttpClient(base)).toThrow(TypeError)
})

test('rejects GET bodies and non-serializable JSON without making a request', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  await expect(client.json('/probe', { body: {} })).rejects.toThrow(TypeError)
  await expect(client.json('/probe', { method: 'POST', body: () => 1 })).rejects.toThrow(TypeError)
  await expect(client.json('/probe', { method: 'POST', body: 1n })).rejects.toThrow(TypeError)
  expect(fetch).not.toHaveBeenCalled()
})

test('preserves abort failures while reading an HTTP error body', async () => {
  const controller = new AbortController()
  const aborted = new DOMException('The operation was aborted', 'AbortError')
  const response = new Response(null, { status: 500 })
  vi.spyOn(response, 'json').mockRejectedValue(aborted)
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    controller.abort()
    return response
  })
  await expect(client.json('/probe', { signal: controller.signal })).rejects.toBe(aborted)
})

test('does not silently accept a failed response decoder', async () => {
  server.use(http.get(`${origin}/api/probe`, () => HttpResponse.json({ ready: 'invalid' })))
  await expect(client.json('/probe', { decode: decodeReady })).rejects.toThrow('Invalid response contract')
})

test.each(['PATCH', 'PUT', 'DELETE'] as const)('sends %s with include credentials and preserves null bodies', async (method) => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
  await expect(client.json('/probe', { method, body: null })).resolves.toBeUndefined()
  expect(fetch).toHaveBeenCalledOnce()
  expect(fetch.mock.calls[0][1]).toMatchObject({ method, body: 'null', credentials: 'include' })
})
