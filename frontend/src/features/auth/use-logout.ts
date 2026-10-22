import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useSession } from '@/shared/auth/use-session'
import { ApiError } from '@/shared/api/api-error'
import { GENERIC_ERROR_MESSAGE, getHttpErrorMessage } from '@/shared/errors/error-messages'
import { useToast } from '@/shared/components/toast-context'
import { logout } from './api'

export function useLogout() {
  const client = useQueryClient()
  const navigate = useNavigate()
  const { clearSession } = useSession()
  const [pending, setPending] = useState(false)
  const toast = useToast()
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => { request.current?.abort() }, [])
  const signOut = useCallback(async () => {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    try {
      await logout(controller.signal)
      if (controller.signal.aborted) return
      await client.cancelQueries()
      if (controller.signal.aborted) return
      client.clear()
      clearSession('logout')
      toast.success('Sessão encerrada.')
      navigate('/login', { replace: true })
    } catch (failure) {
      if (!controller.signal.aborted && !(failure instanceof ApiError && failure.status === 401)) toast.error(failure instanceof ApiError ? getHttpErrorMessage(failure.status) : GENERIC_ERROR_MESSAGE)
    } finally {
      if (request.current === controller) request.current = null
      if (!controller.signal.aborted) setPending(false)
    }
  }, [client, clearSession, navigate, toast])
  return { signOut, pending }
}
