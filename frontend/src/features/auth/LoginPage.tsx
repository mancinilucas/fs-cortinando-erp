import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useSearchParams } from 'react-router'
import { useSession } from '@/shared/auth/use-session'
import { ApiError } from '@/shared/api/api-error'
import { Button } from '@/shared/components/Button'
import { FieldError, TextField } from '@/shared/components/FormFields'
import { ErrorState, LoadingState, Spinner } from '@/shared/components/States'
import { getHttpErrorMessage, GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { login } from './api'
import { loginResolver } from './login-schema'
import { safeReturnTo } from './return-to'
import type { LoginCredentials } from './types'

export const LOGIN_ERROR_MESSAGE = 'E-mail ou senha inválidos.'
const LOGIN_COOLDOWN_MS = 5000

export function LoginPage() {
  const { state, retryBootstrap, setAuthenticated } = useSession()
  const [search] = useSearchParams()
  const [loginDestination, setLoginDestination] = useState<string>()
  const [error, setError] = useState<string>()
  const [cooldown, setCooldown] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const request = useRef<AbortController | null>(null)
  const { register, handleSubmit, resetField, formState: { errors, isSubmitting } } = useForm<LoginCredentials>({
    resolver: loginResolver, defaultValues: { email: '', password: '' },
  })
  useEffect(() => () => { clearTimeout(timer.current); request.current?.abort() }, [])

  const submit = async (values: LoginCredentials) => {
    if (request.current || cooldown) return
    const controller = new AbortController()
    request.current = controller
    setError(undefined)
    try {
      const user = await login(values, controller.signal)
      if (controller.signal.aborted) return
      resetField('password')
      setLoginDestination(safeReturnTo(search.get('returnTo')))
      setAuthenticated(user)
    } catch (failure) {
      if (controller.signal.aborted) return
      setError(failure instanceof ApiError ? failure.status === 401 ? LOGIN_ERROR_MESSAGE : getHttpErrorMessage(failure.status) : GENERIC_ERROR_MESSAGE)
      if (failure instanceof ApiError && failure.status === 429) {
        setCooldown(true)
        timer.current = setTimeout(() => setCooldown(false), LOGIN_COOLDOWN_MS)
      }
    } finally { if (request.current === controller) request.current = null }
  }

  if (state.status === 'authenticated') return <Navigate to={loginDestination ?? '/dashboard'} replace />
  return <main className="min-h-dvh lg:grid lg:grid-cols-2">
    <section className="hidden flex-col justify-center gap-4 bg-brand-navy p-12 text-text-inverse lg:flex" aria-label="Cortinando">
      <p className="font-display text-display">Cortinando</p>
      <p>Cortinas Personalizadas</p>
    </section>
    <section className="flex min-h-dvh items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-110">
        <p className="mb-6 font-display text-page-title text-brand-navy lg:hidden">Cortinando</p>
        <div className="rounded-md border border-border-default bg-surface-primary p-6">
          <h1 className="mb-6 font-display text-page-title text-brand-navy">Entrar</h1>
          {state.status === 'loading' ? <LoadingState label="Verificando sessão…" />
            : state.status === 'error' ? <ErrorState message={state.message} onRetry={retryBootstrap} />
              : <form noValidate onSubmit={(event) => { void handleSubmit(submit)(event) }} className="flex flex-col gap-4" aria-busy={isSubmitting}>
                <TextField label="E-mail" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
                  {...register('email')} error={errors.email?.message} readOnly={isSubmitting} />
                <TextField label="Senha" type="password" autoComplete="current-password"
                  {...register('password')} error={errors.password?.message} readOnly={isSubmitting} />
                {error && <FieldError>{error}</FieldError>}
                {cooldown && <p role="status" className="text-caption text-text-secondary">Aguarde alguns segundos antes de tentar novamente.</p>}
                <Button type="submit" disabled={isSubmitting || cooldown}>{isSubmitting && <Spinner />}{isSubmitting ? 'Entrando…' : 'Entrar'}</Button>
              </form>}
        </div>
      </div>
    </section>
  </main>
}
