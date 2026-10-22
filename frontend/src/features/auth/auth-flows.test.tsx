import { useEffect } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { http, HttpResponse } from 'msw'
import { beforeEach, expect, test, vi } from 'vitest'
import { server } from '@/shared/test/server'
import { AuthProvider } from '@/shared/auth/auth-provider'
import { useSession } from '@/shared/auth/use-session'
import { SessionErrors } from '@/shared/auth/session-errors'
import { ApiError } from '@/shared/api/api-error'
import { createAppQueryClient } from '@/app/query-client'
import { ToastProvider } from '@/shared/components/Toast'
import { LoginPage, LOGIN_ERROR_MESSAGE } from './LoginPage'
import { useLogout } from './use-logout'

const user = { id: 'user-1', email: 'user@example.test' }
beforeEach(() => { server.use(http.get('*/auth/me', () => new HttpResponse(null, { status: 401 }))) })
function Probe() {
  const { state } = useSession()
  const location = useLocation()
  return <><output aria-label="Session">{state.status}</output><output aria-label="Location">{location.pathname}{location.search}</output></>
}
function LogoutProbe() {
  const { signOut, pending } = useLogout()
  return <button disabled={pending} onClick={() => { void signOut() }}>Logout</button>
}
function mount(path = '/login', extra?: React.ReactNode) {
  const client = createAppQueryClient()
  const view = render(<QueryClientProvider client={client}><ToastProvider><AuthProvider><MemoryRouter initialEntries={[path]}>
    <SessionErrors /><Probe />{extra}
    <Routes><Route path="/login" element={<LoginPage />} /><Route path="*" element={<p>Destination</p>} /></Routes>
  </MemoryRouter></AuthProvider></ToastProvider></QueryClientProvider>)
  return { ...view, client }
}
async function fillLogin() {
  const email = await screen.findByLabelText('E-mail')
  fireEvent.change(email, { target: { value: user.email } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'test-password' } })
}
function submit() { fireEvent.click(screen.getByRole('button', { name: 'Entrar' })) }

test('validates required fields without a request and provides autocomplete', async () => {
  const handler = vi.fn(() => HttpResponse.json(user))
  server.use(http.post('*/auth/login', handler))
  mount()
  expect(await screen.findByLabelText('E-mail')).toHaveAttribute('autocomplete', 'username')
  expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'current-password')
  submit()
  expect(await screen.findByText('Informe um e-mail válido.')).toBeVisible()
  expect(screen.getByText('Informe a senha.')).toBeVisible()
  expect(handler).not.toHaveBeenCalled()
})

test.each(['/clientes/c-1?tab=orcamentos', '//evil.test'])('logs in and navigates safely from %s without caching credentials', async (destination) => {
  server.use(http.post('*/auth/login', () => HttpResponse.json(user)))
  const { client } = mount(`/login?returnTo=${encodeURIComponent(destination)}`)
  await fillLogin(); submit()
  await waitFor(() => expect(screen.getByLabelText('Session')).toHaveTextContent('authenticated'))
  await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent(destination.startsWith('//') ? '/dashboard' : destination))
  expect(client.getMutationCache().getAll()).toHaveLength(0)
})

test('redirects already authenticated users from login to dashboard', async () => {
  server.use(http.get('*/auth/me', () => HttpResponse.json(user)))
  mount('/login?returnTo=/clientes')
  await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent('/dashboard'))
  expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument()
})

test('holds loading and prevents repeated submissions', async () => {
  let finish!: () => void
  const pending = new Promise<void>((resolve) => { finish = resolve })
  const handler = vi.fn(async () => { await pending; return HttpResponse.json(user) })
  server.use(http.post('*/auth/login', handler))
  mount(); await fillLogin(); submit()
  const button = await screen.findByRole('button', { name: 'Entrando…' })
  expect(button).toBeDisabled()
  fireEvent.click(button)
  await waitFor(() => expect(handler).toHaveBeenCalledOnce())
  await act(async () => { finish() })
  await screen.findByText('Destination')
})

test('shows a generic credentials error without changing the anonymous state', async () => {
  server.use(http.post('*/auth/login', () => HttpResponse.json({ message: 'secret diagnostic' }, { status: 401 })))
  mount(); await fillLogin(); submit()
  expect(await screen.findByText(LOGIN_ERROR_MESSAGE)).toBeVisible()
  expect(screen.getByLabelText('Session')).toHaveTextContent('anonymous')
  await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent('/login'))
  expect(screen.queryByText(/secret diagnostic/)).not.toBeInTheDocument()
})

test('429 disables submission for five seconds without retrying automatically', async () => {
  const handler = vi.fn(() => new HttpResponse(null, { status: 429 }))
  server.use(http.post('*/auth/login', handler))
  mount(); await fillLogin()
  const realSetTimeout = globalThis.setTimeout
  let finishCooldown!: () => void
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: TimerHandler, timeout?: number, ...args: unknown[]) => {
    if (timeout === 5000 && typeof callback === 'function') { finishCooldown = () => callback(); return 0 }
    return realSetTimeout(callback, timeout, ...args)
  }) as typeof setTimeout)
  submit()
  expect(await screen.findByText('Muitas solicitações. Aguarde um pouco e tente novamente.')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled()
  expect(handler).toHaveBeenCalledOnce()
  act(() => finishCooldown())
  expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  expect(handler).toHaveBeenCalledOnce()
})

test.each([403, 500, 'network'] as const)('keeps login failures %s recoverable', async (status) => {
  server.use(http.post('*/auth/login', () => status === 'network' ? HttpResponse.error() : new HttpResponse(null, { status })))
  mount(); await fillLogin(); submit()
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  expect(screen.getByLabelText('Session')).toHaveTextContent('anonymous')
})

test('shows bootstrap errors with manual retry before exposing the form', async () => {
  server.use(http.get('*/auth/me', () => HttpResponse.error()))
  mount()
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument()
  server.use(http.get('*/auth/me', () => new HttpResponse(null, { status: 401 })))
  fireEvent.click(screen.getByText('Tentar novamente'))
  expect(await screen.findByLabelText('Senha')).toBeVisible()
})

test('successful logout cancels work, clears private cache and session, and navigates to login', async () => {
  server.use(http.get('*/auth/me', () => HttpResponse.json(user)), http.post('*/auth/logout', () => new HttpResponse(null, { status: 204 })))
  const { client } = mount('/clientes', <LogoutProbe />)
  await waitFor(() => expect(screen.getByLabelText('Session')).toHaveTextContent('authenticated'))
  client.setQueryData(['private'], 'private value')
  const cancel = vi.spyOn(client, 'cancelQueries')
  fireEvent.click(screen.getByText('Logout'))
  await waitFor(() => expect(screen.getByLabelText('Session')).toHaveTextContent('anonymous'))
  await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent('/login'))
  expect(client.getQueryCache().getAll()).toHaveLength(0)
  expect(cancel).toHaveBeenCalled()
})

test.each([500, 'network'] as const)('failed logout %s preserves session and private cache', async (status) => {
  server.use(http.get('*/auth/me', () => HttpResponse.json(user)), http.post('*/auth/logout', () => status === 'network' ? HttpResponse.error() : new HttpResponse(null, { status })))
  const { client } = mount('/clientes', <LogoutProbe />)
  await waitFor(() => expect(screen.getByLabelText('Session')).toHaveTextContent('authenticated'))
  client.setQueryData(['private'], 'private value')
  fireEvent.click(screen.getByText('Logout'))
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.getByLabelText('Session')).toHaveTextContent('authenticated')
  expect(client.getQueryData(['private'])).toBe('private value')
  expect(screen.getByLabelText('Location')).toHaveTextContent('/clientes')
})

function ProtectedRequest({ mutation = false }: { mutation?: boolean }) {
  const client = useQueryClient()
  const { state } = useSession()
  useEffect(() => {
    if (state.status !== 'authenticated') return
    const run = () => Promise.reject(new ApiError(401, { messages: [], violations: [] }))
    if (mutation) {
      const action = client.getMutationCache().build(client, { mutationFn: run })
      void action.execute(undefined).catch(() => {})
    } else void client.fetchQuery({ queryKey: ['protected'], queryFn: run }).catch(() => {})
  }, [client, mutation, state.status])
  return null
}
test.each([false, true])('handles a protected 401 once (mutation %s) and preserves returnTo', async (mutation) => {
  server.use(http.get('*/auth/me', () => HttpResponse.json(user)))
  mount('/clientes?search=Maria', <ProtectedRequest mutation={mutation} />)
  await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent('/login?returnTo=%2Fclientes%3Fsearch%3DMaria'))
  expect(screen.getByLabelText('Session')).toHaveTextContent('anonymous')
})

test('ignores a login completion after the page unmounts and aborts its request', async () => {
  let loginSignal: AbortSignal | undefined
  let started!: () => void
  const ready = new Promise<void>((resolve) => { started = resolve })
  server.use(http.post('*/auth/login', ({ request }) => {
    loginSignal = request.signal
    started()
    return new Promise<Response>(() => {})
  }))
  const view = mount()
  await fillLogin(); submit()
  await ready
  view.unmount()
  await waitFor(() => expect(loginSignal?.aborted).toBe(true))
})

test('logout prevents repeated calls while waiting for the server', async () => {
  let finish!: () => void
  const pending = new Promise<void>((resolve) => { finish = resolve })
  const handler = vi.fn(async () => { await pending; return new HttpResponse(null, { status: 204 }) })
  server.use(http.get('*/auth/me', () => HttpResponse.json(user)), http.post('*/auth/logout', handler))
  mount('/clientes', <LogoutProbe />)
  await waitFor(() => expect(screen.getByLabelText('Session')).toHaveTextContent('authenticated'))
  fireEvent.click(screen.getByText('Logout'))
  expect(screen.getByText('Logout')).toBeDisabled()
  fireEvent.click(screen.getByText('Logout'))
  await waitFor(() => expect(handler).toHaveBeenCalledOnce())
  await act(async () => { finish() })
  await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent('/login'))
})

test('protected 401 aborts other queries and clears private data', async () => {
  server.use(http.get('*/auth/me', () => HttpResponse.json(user)))
  const { client } = mount('/orcamentos?status=SENT')
  await waitFor(() => expect(screen.getByLabelText('Session')).toHaveTextContent('authenticated'))
  client.setQueryData(['private'], 'private data')
  let signal: AbortSignal | undefined
  const pending = client.fetchQuery({ queryKey: ['pending'], queryFn: (context) => {
    signal = context.signal
    return new Promise<string>(() => {})
  } }).catch(() => {})
  await act(async () => {
    await client.fetchQuery({ queryKey: ['unauthorized'], queryFn: () => Promise.reject(new ApiError(401, { messages: [], violations: [] })) }).catch(() => {})
    await pending
  })
  expect(signal?.aborted).toBe(true)
  expect(client.getQueryData(['private'])).toBeUndefined()
  await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent('/login?returnTo=%2Forcamentos%3Fstatus%3DSENT'))
})
