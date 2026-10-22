import { expect, test } from 'vitest'
import { safeReturnTo } from './return-to'

test.each([null, '', 'https://evil.test', '//evil.test', '/\\evil.test', '/%2fevil.test', '/%5cevil.test', '/\nevil', '/%0aevil', '/a/..//evil.test', '/%2e%2e//evil.test', '/login', '/login///', '/login%2f', '/login?returnTo=/login', '/x/../login', '/%6cogin', '/%', 'dashboard'])('rejects unsafe or recursive destination %s', (value) => {
  expect(safeReturnTo(value)).toBe('/dashboard')
})
test.each(['/clientes/c-1', '/orcamentos?search=Maria%20Silva#resultados', '/clientes/c-1/orcamentos/novo'])('preserves internal destination %s', (value) => {
  expect(safeReturnTo(value)).toBe(value)
})
