import { expect, test } from 'vitest'
import { readApiBaseUrl } from './env'

test.each([undefined, '', '   '])('defaults to relative paths for %s', (value) => {
  expect(readApiBaseUrl(value)).toBe('')
})

test.each([
  [' https://api.example.test/ ', 'https://api.example.test'],
  ['/api/', '/api'], ['http://localhost:3000', 'http://localhost:3000'],
])('normalizes optional base URL %s', (value, expected) => {
  expect(readApiBaseUrl(value)).toBe(expected)
})
