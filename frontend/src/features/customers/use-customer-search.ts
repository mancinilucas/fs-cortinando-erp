import { useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'

export function useCustomerSearch() {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const search = params.get('search') ?? ''
  const [draft, setDraft] = useState({ key: location.key, value: search })
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Navigation is authoritative, including back/forward while a debounce is pending.
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
  return { search, value: draft.value, changeSearch, isDebouncing: draft.value !== search }
}
