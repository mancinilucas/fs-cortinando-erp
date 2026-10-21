import { QuotesListPage } from '@/features/quotes/QuotesListPage'
import { useEffect } from 'react'
import { Link, matchPath, Navigate, Route, Routes, useLocation, useParams } from 'react-router'
import { CustomerDetailPage } from '@/features/customers/CustomerDetailPage'
import { CustomerFormPage } from '@/features/customers/CustomerFormPage'
import { CustomersListPage } from '@/features/customers/CustomersListPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/shared/auth/RequireAuth'
import { SessionErrors } from '@/shared/auth/session-errors'
import { useSession } from '@/shared/auth/use-session'
import { AppShell } from './AppShell'
import { NotFoundPage } from './NotFoundPage'
import { productRoutes } from './route-definitions'

function RoutePlaceholder({ path }: { path: string }) {
  const { customerId, quoteId } = useParams()
  const backTo = path === '/clientes/novo' || path === '/clientes/:customerId' ? '/clientes'
    : path.startsWith('/clientes/:customerId/') ? `/clientes/${customerId}`
      : path === '/orcamentos/:quoteId' ? '/orcamentos'
        : path === '/orcamentos/:quoteId/editar' ? `/orcamentos/${quoteId}` : undefined
  return <>
    {backTo && <Link to={backTo} className="mb-4 inline-flex min-h-11 items-center text-brand-navy underline">Voltar</Link>}
    <p className="text-text-secondary">Esta página será implementada nas próximas etapas.</p>
  </>
}

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
          {productRoutes.map(({ path }) => <Route key={path} path={path} element={path === '/dashboard' ? <DashboardPage /> : path === '/orcamentos' ? <QuotesListPage /> : path === '/clientes' ? <CustomersListPage /> : path === '/clientes/:customerId' ? <CustomerDetailPage /> : path === '/clientes/novo' || path === '/clientes/:customerId/editar' ? <CustomerFormPage /> : <RoutePlaceholder path={path} />} />)}
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </>
}
