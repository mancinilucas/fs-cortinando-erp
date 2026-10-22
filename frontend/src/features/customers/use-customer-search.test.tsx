import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { expect, test, vi } from 'vitest'
import { useCustomerSearch } from './use-customer-search'

test('commits only after 300ms from the final keystroke', async () => {
  vi.useFakeTimers()
  try {
    const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={['/clientes?context=preserved']}>{children}</MemoryRouter>
    const view = renderHook(() => ({ ...useCustomerSearch(), location: useLocation() }), { wrapper })
    act(() => view.result.current.changeSearch('A'))
    await act(async () => { await vi.advanceTimersByTimeAsync(250) })
    act(() => view.result.current.changeSearch('Ana'))
    await act(async () => { await vi.advanceTimersByTimeAsync(299) })
    expect(view.result.current.location.search).toBe('?context=preserved')
    expect(view.result.current.isDebouncing).toBe(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(view.result.current.location.search).toBe('?context=preserved&search=Ana')
    expect(view.result.current.value).toBe('Ana')
    expect(view.result.current.isDebouncing).toBe(false)
    view.unmount()
  } finally { vi.useRealTimers() }
})
