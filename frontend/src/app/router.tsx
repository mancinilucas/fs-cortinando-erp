import { QuoteDetailPage } from '@/features/quotes/QuoteDetailPage'
import { QuoteCreatePage } from '@/features/quotes/QuoteCreatePage'
import { QuoteEditPage } from '@/features/quotes/QuoteEditPage'
import { QuotesListPage } from '@/features/quotes/QuotesListPage'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { matchPath, Navigate, Route, Routes, useLocation } from 'react-router'
import { CustomerDetailPage } from '@/features/customers/CustomerDetailPage'
import { CustomerFormPage } from '@/features/customers/CustomerFormPage'
import { CustomersListPage } from '@/features/customers/CustomersListPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { BusinessDataPage } from '@/features/business-data/BusinessDataPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/shared/auth/RequireAuth'
import { SessionErrors } from '@/shared/auth/session-errors'
import { useSession } from '@/shared/auth/use-session'
import { AppShell } from './AppShell'
import { NotFoundPage } from './NotFoundPage'
import { productRoutes } from './route-definitions'

const productPages = {
  '/dashboard': <DashboardPage />,
  '/clientes': <CustomersListPage />,
  '/clientes/novo': <CustomerFormPage />,
  '/clientes/:customerId': <CustomerDetailPage />,
  '/clientes/:customerId/editar': <CustomerFormPage />,
  '/clientes/:customerId/orcamentos/novo': <QuoteCreatePage />,
  '/orcamentos': <QuotesListPage />,
  '/orcamentos/:quoteId': <QuoteDetailPage />,
  '/orcamentos/:quoteId/editar': <QuoteEditPage />,
  '/configuracoes/dados-do-negocio': <BusinessDataPage />,
} satisfies Record<(typeof productRoutes)[number]['path'], ReactNode>

function RouteEffects() {
  const { pathname } = useLocation()
  const { state } = useSession()
  const title = pathname === '/login' ? 'Entrar'
    : pathname === '/' ? undefined
      : productRoutes.find((route) => matchPath(route.path, pathname))?.title ?? 'Página não encontrada'
  useEffect(() => {
    document.title = title ? `${title} | Cortinando ERP` : 'Cortinando ERP'
  }, [title])
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      document.querySelector<HTMLElement>('[data-page-title]')?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [pathname, state.status])
  return null
}

export function AppRoutes() {
  return <>
    <SessionErrors />
    <RouteEffects />
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          {productRoutes.map(({ path }) => <Route key={path} path={path} element={productPages[path]} />)}
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </>
}
