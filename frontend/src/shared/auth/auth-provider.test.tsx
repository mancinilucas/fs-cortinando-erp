import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { expect, test, vi } from 'vitest'
import { server } from '@/shared/test/server'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { AuthProvider } from './auth-provider'
import { useSession } from './use-session'

const user = { id: 'user-1', email: 'user@example.test' }
function Probe() {
  const { state, retryBootstrap, setAuthenticated, clearSession } = useSession()
  return <>
    <p>{state.status}</p>
    {state.status === 'authenticated' && <p>{state.user.email}</p>}
    {state.status === 'error' && <p>{state.message}</p>}
    <button onClick={retryBootstrap}>Retry</button>
    <button onClick={() => setAuthenticated(user)}>Authenticate</button>
    <button onClick={clearSession}>Clear</button>
  </>
}
function mount() { return render(<AuthProvider><Probe /></AuthProvider>) }

test('bootstraps once under StrictMode and ordinary rerenders', async () => {
  const handler = vi.fn(() => HttpResponse.json(user))
  server.use(http.get('*/auth/me', handler))
  const tree = <StrictMode><AuthProvider><Probe /></AuthProvider></StrictMode>
  const view = render(tree)
  expect(screen.getByText('loading')).toBeVisible()
  expect(await screen.findByText(user.email)).toBeVisible()
  view.rerender(tree)
  expect(handler).toHaveBeenCalledOnce()
})

test('treats bootstrap 401 as anonymous', async () => {
  server.use(http.get('*/auth/me', () => new HttpResponse(null, { status: 401 })))
  mount()
  expect(await screen.findByText('anonymous')).toBeVisible()
})

test.each(['server', 'network', 'malformed'] as const)('keeps %s failures distinct from anonymous and retries manually', async (failure) => {
  const handler = vi.fn(() => failure === 'network' ? HttpResponse.error()
    : failure === 'malformed' ? HttpResponse.json({ token: 'private' })
      : HttpResponse.json({ message: 'private diagnostic' }, { status: 500 }))
  server.use(http.get('*/auth/me', handler))
  mount()
  expect(await screen.findByText('error')).toBeVisible()
  expect(screen.queryByText('anonymous')).not.toBeInTheDocument()
  expect(screen.queryByText(/private/)).not.toBeInTheDocument()
  if (failure !== 'server') expect(screen.getByText(GENERIC_ERROR_MESSAGE)).toBeVisible()
  expect(handler).toHaveBeenCalledOnce()
  server.use(http.get('*/auth/me', () => HttpResponse.json(user)))
  fireEvent.click(screen.getByText('Retry'))
  expect(await screen.findByText(user.email)).toBeVisible()
})

test.each(['Authenticate', 'Clear'])('ignores late bootstrap after %s', async (action) => {
  let complete!: (response: Response) => void
  const pending = new Promise<Response>((resolve) => { complete = resolve })
  // Simulate a response source that completes even after cancellation.
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValue(pending)
  mount()
  await waitFor(() => expect(fetchSpy).toHaveBeenCalledOnce())
  fireEvent.click(screen.getByText(action))
  await act(async () => {
    complete(new Response(JSON.stringify({ id: 'old', email: 'old@example.test' })))
    await pending
  })
  expect(screen.getByText(action === 'Clear' ? 'anonymous' : user.email)).toBeVisible()
  expect(screen.queryByText('old@example.test')).not.toBeInTheDocument()
})

test('aborts on unmount and starts a new bootstrap on remount', async () => {
  let requestSignal: AbortSignal | undefined
  server.use(http.get('*/auth/me', ({ request }) => {
    requestSignal = request.signal
    return new Promise<Response>(() => {})
  }))
  const view = mount()
  await waitFor(() => expect(requestSignal).toBeDefined())
  view.unmount()
  await waitFor(() => expect(requestSignal?.aborted).toBe(true))
  server.use(http.get('*/auth/me', () => HttpResponse.json(user)))
  mount()
  expect(await screen.findByText(user.email)).toBeVisible()

})


test('keeps session in memory without accessing browser storage or cookies', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(user), { headers: { 'Content-Type': 'application/json' } }))
  const localRead = vi.spyOn(Storage.prototype, 'getItem')
  const localWrite = vi.spyOn(Storage.prototype, 'setItem')
  const cookieRead = vi.spyOn(document, 'cookie', 'get')
  const cookieWrite = vi.spyOn(document, 'cookie', 'set')
  mount()
  expect(await screen.findByText(user.email)).toBeVisible()
  fireEvent.click(screen.getByText('Clear'))
  expect(screen.getByText('anonymous')).toBeVisible()
  expect(localRead).not.toHaveBeenCalled()
  expect(localWrite).not.toHaveBeenCalled()
  expect(cookieRead).not.toHaveBeenCalled()
  expect(cookieWrite).not.toHaveBeenCalled()
})
