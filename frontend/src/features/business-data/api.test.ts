import { http, HttpResponse } from 'msw'
import { expect, test, vi } from 'vitest'
import { server } from '@/shared/test/server'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { getBusinessData, updateBusinessData } from './api'

const record = { commercialNameOrConsultant: 'Cortinando', phone: '(11) 99999-9999', email: null, taxId: null, updatedAt: '2026-10-21T13:00:00.000Z' }

test('GET reads the configured response with credentials and omits internal fields', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
  server.use(http.get('*/dados-do-negocio', () => HttpResponse.json({ ...record, id: 'private-id' })))
  await expect(getBusinessData()).resolves.toEqual(record)
  expect(fetchSpy).toHaveBeenCalledWith('/dados-do-negocio', expect.objectContaining({ credentials: 'include', method: 'GET' }))
})

test('preserves 404 for the page to interpret as unconfigured', async () => {
  server.use(http.get('*/dados-do-negocio', () => HttpResponse.json({ message: 'Business data not found' }, { status: 404 })))
  await expect(getBusinessData()).rejects.toMatchObject({ status: 404 })
})

test('PUT always sends all four fields including null optional values and returns server data', async () => {
  const handler = vi.fn(async ({ request }: { request: Request }) => {
    expect(await request.json()).toEqual({ commercialNameOrConsultant: 'Cortinando', phone: '11999999999', email: null, taxId: null })
    return HttpResponse.json({ ...record, commercialNameOrConsultant: 'Normalized by server' })
  })
  server.use(http.put('*/dados-do-negocio', handler))
  await expect(updateBusinessData({ commercialNameOrConsultant: 'Cortinando', phone: '11999999999', email: null, taxId: null })).resolves.toMatchObject({ commercialNameOrConsultant: 'Normalized by server' })
  expect(handler).toHaveBeenCalledOnce()
})

test('rejects malformed server data with a safe message', async () => {
  server.use(http.get('*/dados-do-negocio', () => HttpResponse.json({ ...record, updatedAt: 'invalid' })))
  await expect(getBusinessData()).rejects.toMatchObject({ message: GENERIC_ERROR_MESSAGE })
})
