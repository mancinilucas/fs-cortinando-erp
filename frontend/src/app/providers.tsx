import { useState } from 'react'
import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/shared/auth/auth-provider'
import { createAppQueryClient } from './query-client'

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(createAppQueryClient)
  return <QueryClientProvider client={client}><AuthProvider>{children}</AuthProvider></QueryClientProvider>
}
