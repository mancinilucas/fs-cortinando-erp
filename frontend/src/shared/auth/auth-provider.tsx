import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { getCurrentUser } from '@/features/auth/api'
import type { AuthState, AuthUser } from '@/features/auth/types'
import { ApiError } from '@/shared/api/api-error'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { AuthContext } from './auth-context'

type BootstrapRequest = { controller: AbortController; promise: Promise<AuthUser> }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const request = useRef<BootstrapRequest | null>(null)
  const version = useRef(0)
  const mounted = useRef(false)

  useEffect(() => {
    let active = true
    mounted.current = true
    const currentVersion = version.current
    if (!request.current) {
      const controller = new AbortController()
      request.current = { controller, promise: getCurrentUser(controller.signal) }
    }
    const current = request.current
    void current.promise.then((user) => {
      if (active && currentVersion === version.current) setState({ status: 'authenticated', user })
    }, (error: unknown) => {
      if (!active || currentVersion !== version.current) return
      if (error instanceof ApiError && error.status === 401) setState({ status: 'anonymous' })
      else setState({ status: 'error', message: error instanceof ApiError ? error.message : GENERIC_ERROR_MESSAGE })
    })
    return () => {
      active = false
      mounted.current = false
      // StrictMode immediately re-subscribes; only a real unmount aborts this request.
      queueMicrotask(() => { if (!mounted.current) current.controller.abort() })
    }
  }, [attempt])

  const invalidateBootstrap = useCallback(() => {
    version.current += 1
    request.current?.controller.abort()
    request.current = null
  }, [])

  const retryBootstrap = useCallback(() => {
    invalidateBootstrap()
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }, [invalidateBootstrap])

  const setAuthenticated = useCallback((user: AuthUser) => {
    invalidateBootstrap()
    setState({ status: 'authenticated', user: { id: user.id, email: user.email } })
  }, [invalidateBootstrap])

  const clearSession = useCallback((reason?: 'logout') => {
    invalidateBootstrap()
    setState({ status: 'anonymous', reason })
  }, [invalidateBootstrap])

  const value = useMemo(() => ({ state, retryBootstrap, setAuthenticated, clearSession }),
    [state, retryBootstrap, setAuthenticated, clearSession])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
