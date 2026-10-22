import clsx from 'clsx'
import { LayoutDashboard, LogOut, Settings, Users, FileText } from 'lucide-react'
import { matchPath, NavLink, Outlet, useLocation } from 'react-router'
import { useLogout } from '@/features/auth/use-logout'
import { useSession } from '@/shared/auth/use-session'
import { Button } from '@/shared/components/Button'
import { Spinner } from '@/shared/components/States'
import { productRoutes } from './route-definitions'

const destinations = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/orcamentos', label: 'Orçamentos', icon: FileText },
  { to: '/configuracoes/dados-do-negocio', label: 'Configurações', icon: Settings },
]

function Navigation({ mobile = false }: { mobile?: boolean }) {
  return <nav aria-label={mobile ? 'Navegação principal mobile' : 'Navegação principal desktop'}
    className={mobile ? 'grid grid-cols-4' : 'flex flex-col gap-2'}>
    {destinations.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} aria-label={label}
      className={({ isActive }) => clsx('flex min-h-11 items-center', mobile
        ? 'min-h-14 min-w-0 flex-col justify-center gap-1 border-t-2 px-1 text-[0.6875rem]'
        : 'gap-3 border-l-3 px-4 py-3 text-label font-medium',
      isActive ? mobile ? 'border-brand-navy font-semibold text-brand-navy' : 'border-brand-navy bg-brand-navy-tint text-brand-navy'
        : 'border-transparent text-text-secondary hover:bg-surface-alt')}>
      {({ isActive }) => <><Icon size={22} strokeWidth={isActive ? 2.5 : 1.75} aria-hidden="true" /><span className="max-w-full text-center">{mobile && label === 'Configurações' ? 'Config.' : label}</span></>}
    </NavLink>)}
  </nav>
}

export function AppShell() {
  const { pathname } = useLocation()
  const { state } = useSession()
  const { signOut, pending } = useLogout()
  const title = productRoutes.find((route) => matchPath(route.path, pathname))?.title ?? 'Cortinando ERP'
  return <div className="min-h-dvh lg:pl-62">
    <a href="#main-content" className="sr-only fixed left-4 top-4 z-50 rounded-sm bg-surface-primary p-3 focus:not-sr-only">Ir para o conteúdo</a>
    <aside className="fixed inset-y-0 left-0 hidden w-62 flex-col border-r border-border-default bg-surface-primary lg:flex">
      <p className="px-6 py-8 font-display text-page-title text-brand-navy">Cortinando</p>
      <Navigation />
      {state.status === 'authenticated' && <p className="mt-auto break-words p-6 text-caption text-text-secondary">{state.user.email}</p>}
    </aside>
    <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border-default bg-surface-primary px-4 py-2 lg:px-8">
      <h1 data-page-title tabIndex={-1} className="min-w-0 break-words">{title}</h1>
      <Button variant="text" disabled={pending} onClick={() => { void signOut() }} className="shrink-0">
        {pending ? <Spinner /> : <LogOut size={20} aria-hidden="true" />}{pending ? 'Saindo…' : 'Sair'}
      </Button>
    </header>
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-310 px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:p-8">
      <Outlet />
    </main>
    <div className="fixed inset-x-0 bottom-0 border-t border-border-default bg-surface-primary pb-[env(safe-area-inset-bottom)] lg:hidden">
      <Navigation mobile />
    </div>
  </div>
}
