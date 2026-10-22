import { useState } from 'react'
import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/shared/auth/auth-provider'
import { ToastProvider } from '@/shared/components/Toast'
import { createAppQueryClient } from './query-client'

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(createAppQueryClient)
  return <QueryClientProvider client={client}><ToastProvider><AuthProvider>{children}</AuthProvider></ToastProvider></QueryClientProvider>
}
