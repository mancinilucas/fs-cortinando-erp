import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { ApiError } from '@/shared/api/api-error'
import { safeReturnTo } from '@/features/auth/return-to'
import { useSession } from './use-session'

// Observe API work managed by Query; login/logout use their own local error flows.
export function SessionErrors() {
  const client = useQueryClient()
  const { state, clearSession } = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  const handling = useRef(false)
  useEffect(() => {
    if (state.status !== 'authenticated') return
    handling.current = false
    const handleError = (error: unknown) => {
      if (!(error instanceof ApiError) || error.status !== 401 || handling.current) return
      handling.current = true
      clearSession()
      void client.cancelQueries()
      client.clear()
      const destination = safeReturnTo(`${location.pathname}${location.search}${location.hash}`)
      navigate(`/login?returnTo=${encodeURIComponent(destination)}`, { replace: true })
    }
    const unsubscribeQueries = client.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'error') handleError(event.action.error)
    })
    const unsubscribeMutations = client.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'error') handleError(event.action.error)
    })
    return () => { unsubscribeQueries(); unsubscribeMutations() }
  }, [client, state.status, clearSession, location.pathname, location.search, location.hash, navigate])
  return null
}
