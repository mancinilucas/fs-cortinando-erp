// @vitest-environment node
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { expect, test } from 'vitest'
import config from './vite.config.ts'

const server = config.server
if (!server?.proxy) throw new Error('Development proxy is required')
const proxies = server.proxy

test('fixes the localhost development origin instead of silently changing port', () => {
  expect(server.host).toBe('localhost')
  expect(server.port).toBe(5173)
  expect(server.strictPort).toBe(true)
  expect(Object.keys(proxies)).toEqual(['/auth', '/clientes', '/orcamentos', '/dashboard', '/dados-do-negocio'])
})

test.each(Object.entries(proxies))('keeps %s API requests distinct from SPA navigation', async (_path, proxy) => {
  if (typeof proxy === 'string') throw new Error('Explicit proxy options are required')
  expect(proxy.target).toBe('http://localhost:3000')
  expect(proxy.changeOrigin).toBe(false)
  const socket = new Socket()
  const request = new IncomingMessage(socket)
  const response = new ServerResponse(request)
  try {
    request.method = 'GET'
    request.headers.accept = 'text/html,application/xhtml+xml'
    expect(await proxy.bypass?.(request, response, proxy)).toBe('/index.html')
    request.headers.accept = 'application/json'
    request.headers.origin = 'http://localhost:5173'
    expect(await proxy.bypass?.(request, response, proxy)).toBeUndefined()
    expect(request.headers.origin).toBe('http://localhost:5173')
    request.method = 'POST'
    request.headers.accept = 'text/html'
    expect(await proxy.bypass?.(request, response, proxy)).toBeUndefined()
    request.method = 'GET'
    delete request.headers.accept
    expect(await proxy.bypass?.(request, response, proxy)).toBeUndefined()
  } finally {
    response.destroy()
    socket.destroy()
  }
})
