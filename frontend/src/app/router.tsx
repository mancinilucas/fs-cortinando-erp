import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { matchPath, Navigate, Route, Routes, useLocation } from 'react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { SessionErrors } from '@/shared/auth/session-errors'
import { productRoutes } from './route-definitions'

function RoutePlaceholder({ title }: { title: string }) {
  return <main className="p-4"><h1>{title}</h1></main>
}

function ProtectedRoutePlaceholder() {
  // No Outlet: product pages stay inaccessible until the real session boundary exists.
  return <RoutePlaceholder title="Cortinando ERP" />
}

function RouteMetadata() {
  const { pathname } = useLocation()
  const title = pathname === '/login' ? 'Entrar'
    : pathname === '/' ? undefined
      : productRoutes.find((route) => matchPath(route.path, pathname))?.title ?? 'Página não encontrada'
  useEffect(() => {
    document.title = title ? `${title} | Cortinando ERP` : 'Cortinando ERP'
  }, [title])
  return null
}

export function AppRoutes({ protectedElement = <ProtectedRoutePlaceholder /> }: { protectedElement?: ReactNode }) {
  return <>
    <SessionErrors />
    <RouteMetadata />
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={protectedElement}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        {productRoutes.map(({ path, title }) => <Route key={path} path={path} element={<RoutePlaceholder title={title} />} />)}
      </Route>
      <Route path="*" element={<RoutePlaceholder title="Página não encontrada" />} />
    </Routes>
  </>
}
