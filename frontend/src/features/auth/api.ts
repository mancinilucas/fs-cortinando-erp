import { httpClient } from '@/shared/api/http-client'
import type { AuthUser, LoginCredentials } from './types'

function decodeAuthUser(value: unknown): AuthUser {
  if (typeof value !== 'object' || value === null || !Object.hasOwn(value, 'id') || !Object.hasOwn(value, 'email')
    || !('id' in value) || typeof value.id !== 'string' || !value.id
    || !('email' in value) || typeof value.email !== 'string' || !value.email) {
    throw new TypeError('Authentication response must contain a user identity')
  }
  return { id: value.id, email: value.email }
}

function requireUser(value: AuthUser | undefined): AuthUser {
  if (!value) throw new TypeError('Authentication response must contain a user identity')
  return value
}

export async function getCurrentUser(signal?: AbortSignal): Promise<AuthUser> {
  return requireUser(await httpClient.json('/auth/me', { signal, decode: decodeAuthUser }))
}

export async function login(credentials: LoginCredentials, signal?: AbortSignal): Promise<AuthUser> {
  return requireUser(await httpClient.json('/auth/login', {
    method: 'POST', body: { email: credentials.email, password: credentials.password }, signal, decode: decodeAuthUser,
  }))
}

export async function logout(signal?: AbortSignal): Promise<void> {
  const response = await httpClient.json('/auth/logout', { method: 'POST', signal })
  if (response !== undefined) throw new TypeError('Logout response must have no body')
}
