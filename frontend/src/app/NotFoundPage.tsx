import { Link } from 'react-router'

export function NotFoundPage() {
  return <main className="mx-auto max-w-110 p-6">
    <h1 data-page-title tabIndex={-1} className="mb-4">Página não encontrada</h1>
    <p className="mb-4 text-text-secondary">Não encontramos a página solicitada.</p>
    <Link to="/dashboard" className="inline-flex min-h-11 items-center text-brand-navy underline">Ir para o dashboard</Link>
  </main>
}
