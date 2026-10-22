import { useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { quoteSearchSchema } from './schema'
import type { QuoteSearch } from './types'

export function useQuoteFilters() {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const search = params.get('search') ?? ''
  const parsed = quoteSearchSchema.shape.status.safeParse(params.get('status') ?? undefined)
  const status = parsed.success ? parsed.data : undefined
  const [draft, setDraft] = useState({ key: location.key, value: search })
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  if (draft.key !== location.key) setDraft({ key: location.key, value: search })
  useEffect(() => () => clearTimeout(timer.current), [location.key])

  function changeSearch(value: string) {
    setDraft({ key: location.key, value })
    clearTimeout(timer.current)
    if (value === search) return
    timer.current = setTimeout(() => {
      setParams((previous) => {
        const next = new URLSearchParams(previous)
        if (value) next.set('search', value)
        else next.delete('search')
        return next
      }, { replace: true })
    }, 300)
  }
  function changeStatus(value: QuoteSearch['status']) {
    clearTimeout(timer.current)
    const next = new URLSearchParams(params)
    if (draft.value) next.set('search', draft.value)
    else next.delete('search')
    if (value) next.set('status', value)
    else next.delete('status')
    setParams(next)
  }
  function clearFilters() {
    clearTimeout(timer.current)
    setDraft({ key: location.key, value: '' })
    const next = new URLSearchParams(params)
    next.delete('search'); next.delete('status')
    setParams(next)
  }
  return { search, status, value: draft.value, changeSearch, changeStatus, clearFilters,
    isDebouncing: draft.value !== search, hasFilters: Boolean(draft.value || params.has('search') || params.has('status')) }
}
