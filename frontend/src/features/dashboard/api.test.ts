import { http, HttpResponse } from 'msw'
import { expect, test, vi } from 'vitest'
import { server } from '@/shared/test/server'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { getDashboard } from './api'
import { dashboardFixture, emptyDashboardFixture } from './fixtures.test-support'

test('reads one relative endpoint with credentials and preserves server counters, groups, order and dates', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
  const handler = vi.fn(({ request }: { request: Request }) => {
    expect(new URL(request.url).search).toBe('')
    return HttpResponse.json(dashboardFixture)
  })
  server.use(http.get('*/dashboard', handler))
  await expect(getDashboard()).resolves.toEqual(dashboardFixture)
  expect(handler).toHaveBeenCalledOnce()
  expect(fetchSpy).toHaveBeenCalledWith('/dashboard', expect.objectContaining({ credentials: 'include', method: 'GET' }))
})

test('accepts zero counters and empty lists without manufacturing data', async () => {
  server.use(http.get('*/dashboard', () => HttpResponse.json(emptyDashboardFixture)))
  await expect(getDashboard()).resolves.toEqual(emptyDashboardFixture)
})

test('projects only public fields and discards contact, financial and unknown data', async () => {
  server.use(http.get('*/dashboard', () => HttpResponse.json({
    ...dashboardFixture, privateField: 'private',
    statusCounts: { ...dashboardFixture.statusCounts, completed: 100 },
    upcomingInstallations: [{ ...dashboardFixture.upcomingInstallations[0], customerPhone: 'private', totalCents: 123 }],
  })))
  const result = await getDashboard()
  expect(result).toEqual({ ...dashboardFixture, upcomingInstallations: [dashboardFixture.upcomingInstallations[0]] })
  expect(JSON.stringify(result)).not.toContain('private')
})

test.each([
  null, {}, { ...dashboardFixture, statusCounts: { ...dashboardFixture.statusCounts, sent: -1 } },
  { ...dashboardFixture, statusCounts: { ...dashboardFixture.statusCounts, expired: 1.5 } },
  { ...dashboardFixture, statusCounts: { ...dashboardFixture.statusCounts, draft: '17' } },
  { ...dashboardFixture, weeklyInstallations: null },
  { ...dashboardFixture, overdueInstallations: [{ ...dashboardFixture.overdueInstallations[0], status: 'EXPIRED' }] },
  { ...dashboardFixture, upcomingInstallations: [{ ...dashboardFixture.upcomingInstallations[0], scheduledInstallationAt: 'invalid' }] },
])('rejects malformed payload %# with a safe error', async (body) => {
  server.use(http.get('*/dashboard', () => HttpResponse.json(body)))
  await expect(getDashboard()).rejects.toMatchObject({ name: 'ApiError', message: GENERIC_ERROR_MESSAGE })
})

test('rejects an empty 204 response instead of presenting an empty dashboard', async () => {
  server.use(http.get('*/dashboard', () => new HttpResponse(null, { status: 204 })))
  await expect(getDashboard()).rejects.toMatchObject({ status: 204 })
})

test.each([401, 403, 429, 500])('propagates HTTP %i without retries', async (status) => {
  const handler = vi.fn(() => HttpResponse.json({ message: 'private diagnostic' }, { status }))
  server.use(http.get('*/dashboard', handler))
  await expect(getDashboard()).rejects.toMatchObject({ status })
  expect(handler).toHaveBeenCalledOnce()
})

test('propagates network failures', async () => {
  server.use(http.get('*/dashboard', () => HttpResponse.error()))
  await expect(getDashboard()).rejects.toBeInstanceOf(TypeError)
})
