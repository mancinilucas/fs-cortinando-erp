import { http, HttpResponse } from 'msw'
import { expect, test, vi } from 'vitest'
import { server } from '@/shared/test/server'
import { getCurrentUser, login, logout } from './api'

const user = { id: 'user-1', email: 'user@example.test' }

test('loads only the identity with browser credentials', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
  server.use(http.get('*/auth/me', () => {
    return HttpResponse.json({ ...user, token: 'discarded', password: 'discarded' })
  }))
  await expect(getCurrentUser()).resolves.toEqual(user)
  expect(fetchSpy).toHaveBeenCalledWith('/auth/me', expect.objectContaining({ credentials: 'include' }))
})

test.each([{}, { id: 'user-1' }, { id: 1, email: user.email }, null])('rejects an invalid identity %j', async (body) => {
  server.use(http.get('*/auth/me', () => HttpResponse.json(body)))
  await expect(getCurrentUser()).rejects.toThrow()
})

test('rejects an empty successful identity response', async () => {
  server.use(http.get('*/auth/me', () => new HttpResponse(null, { status: 204 })))
  await expect(getCurrentUser()).rejects.toThrow()
})

test('posts only login credentials and returns a decoded identity', async () => {
  server.use(http.post('*/auth/login', async ({ request }) => {
    expect(await request.json()).toEqual({ email: user.email, password: 'test-password' })
    return HttpResponse.json(user)
  }))
  await expect(login({ email: user.email, password: 'test-password' })).resolves.toEqual(user)
})

test.each([401, 429, 500])('propagates login HTTP %i without retries', async (status) => {
  const handler = vi.fn(() => HttpResponse.json({ message: 'private diagnostic' }, { status }))
  server.use(http.post('*/auth/login', handler))
  await expect(login({ email: user.email, password: 'test-password' })).rejects.toMatchObject({ status })
  expect(handler).toHaveBeenCalledOnce()
})

test('logs out with an empty POST and accepts 204', async () => {
  server.use(http.post('*/auth/logout', async ({ request }) => {
    expect(await request.text()).toBe('')
    return new HttpResponse(null, { status: 204 })
  }))
  await expect(logout()).resolves.toBeUndefined()
})

test('propagates logout failures', async () => {
  server.use(http.post('*/auth/logout', () => new HttpResponse(null, { status: 500 })))
  await expect(logout()).rejects.toMatchObject({ status: 500 })
})

test('forwards cancellation', async () => {
  const controller = new AbortController()
  controller.abort()
  await expect(getCurrentUser(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
})
