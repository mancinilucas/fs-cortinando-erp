import { Navigate, Outlet, useLocation } from 'react-router'
import { safeReturnTo } from '@/features/auth/return-to'
import { ErrorState, LoadingState } from '@/shared/components/States'
import { useSession } from './use-session'

export function RequireAuth() {
  const { state, retryBootstrap } = useSession()
  const location = useLocation()
  if (state.status === 'authenticated') return <Outlet />
  if (state.status === 'anonymous') {
    const destination = safeReturnTo(`${location.pathname}${location.search}${location.hash}`)
    return <Navigate to={state.reason === 'logout' || location.pathname === '/' ? '/login' : `/login?returnTo=${encodeURIComponent(destination)}`} replace />
  }
  return <main className="mx-auto max-w-110 p-4">
    <h1 data-page-title tabIndex={-1} className="mb-4">Cortinando ERP</h1>
    {state.status === 'loading' ? <LoadingState label="Verificando sessão…" />
      : <ErrorState message={state.message} onRetry={retryBootstrap} />}
  </main>
}
