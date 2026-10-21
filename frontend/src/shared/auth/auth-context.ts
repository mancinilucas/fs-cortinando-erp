import { createContext } from 'react'
import type { AuthState, AuthUser } from '@/features/auth/types'

export type SessionContextValue = {
  state: AuthState
  retryBootstrap: () => void
  setAuthenticated: (user: AuthUser) => void
  clearSession: () => void
}

export const AuthContext = createContext<SessionContextValue | undefined>(undefined)
