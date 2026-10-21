import { useContext } from 'react'
import { AuthContext } from './auth-context'

export function useSession() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useSession must be used within AuthProvider')
  return value
}
