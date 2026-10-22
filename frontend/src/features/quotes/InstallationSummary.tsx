import { useState } from 'react'
import { ClockAlert } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { formatDateTime } from '@/shared/format/dates'
import { DetailFields } from './QuoteReadOnlySections'
import { InstallationDialog } from './InstallationDialog'
import type { QuoteDetail } from './types'

export function InstallationSummary({ quote }: { quote: QuoteDetail }) {
  const [mode, setMode] = useState<'schedule' | 'remove'>()
  const permitted = quote.status === 'CONFIRMED' || quote.status === 'IN_PRODUCTION'
  return <section aria-labelledby="quote-installation-title" className="space-y-4 rounded-md border border-border-default bg-surface-primary p-4 sm:p-6">
    <h2 id="quote-installation-title" className="text-section-title font-semibold">Instalação</h2>
    <DetailFields values={[["Data agendada", quote.scheduledInstallationAt ? formatDateTime(quote.scheduledInstallationAt) : null]]} />
    {quote.lateInstallation && <p role="status" className="flex items-center gap-2 text-warning-fg"><ClockAlert aria-hidden="true" size={20} />Instalação em atraso</p>}
    {quote.installationAddress ? <DetailFields values={[
      ['CEP', quote.installationAddress.postalCode], ['Rua', quote.installationAddress.street], ['Número', quote.installationAddress.number],
      ['Complemento', quote.installationAddress.complement], ['Bairro', quote.installationAddress.neighborhood], ['Cidade', quote.installationAddress.city], ['UF', quote.installationAddress.state],
    ]} /> : <p className="text-text-secondary">Endereço de instalação não informado.</p>}
    {permitted && <div className="flex flex-wrap gap-3">
      <Button variant="secondary" disabled={mode !== undefined} onClick={() => setMode('schedule')}>{quote.scheduledInstallationAt ? 'Alterar instalação' : 'Agendar instalação'}</Button>
      {quote.scheduledInstallationAt && <Button variant="destructive" disabled={mode !== undefined} onClick={() => setMode('remove')}>Remover instalação</Button>}
    </div>}
    {mode && <InstallationDialog quote={quote} mode={mode} onClose={() => setMode(undefined)} />}
  </section>
}
