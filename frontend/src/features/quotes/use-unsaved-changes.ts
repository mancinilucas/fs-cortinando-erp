import { useEffect } from 'react'
import { useBlocker } from 'react-router'

export function useUnsavedChanges(dirty: boolean) {
  const blocker = useBlocker(dirty)
  useEffect(() => {
    if (!dirty) return
    function beforeUnload(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])
  return blocker
}
