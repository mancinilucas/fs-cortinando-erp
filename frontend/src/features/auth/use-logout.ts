import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useSession } from '@/shared/auth/use-session'
import { ApiError } from '@/shared/api/api-error'
import { GENERIC_ERROR_MESSAGE, getHttpErrorMessage } from '@/shared/errors/error-messages'
import { logout } from './api'

export function useLogout() {
  const client = useQueryClient()
  const navigate = useNavigate()
  const { clearSession } = useSession()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => { request.current?.abort() }, [])
  const signOut = useCallback(async () => {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setError(undefined)
    try {
      await logout(controller.signal)
      if (controller.signal.aborted) return
      await client.cancelQueries()
      if (controller.signal.aborted) return
      client.clear()
      clearSession()
      navigate('/login', { replace: true })
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof ApiError ? getHttpErrorMessage(failure.status) : GENERIC_ERROR_MESSAGE)
    } finally {
      if (request.current === controller) request.current = null
      if (!controller.signal.aborted) setPending(false)
    }
  }, [client, clearSession, navigate])
  return { signOut, pending, error }
}
