import { Link } from 'react-router'
import { ApiError } from '@/shared/api/api-error'
import { Button } from '@/shared/components/Button'
import { ErrorState, Spinner } from '@/shared/components/States'
import { GENERIC_ERROR_MESSAGE, getKnownErrorMessage } from '@/shared/errors/error-messages'
import type { QuoteDetail } from './types'
import { useQuoteDocument } from './use-quote-document'

export function QuoteDocuments({ quote }: { quote: QuoteDetail }) {
  const { generate, pending, failure, notice } = useQuoteDocument(quote)
  const production = ['CONFIRMED', 'IN_PRODUCTION', 'COMPLETED'].includes(quote.status)
  const commercial = quote.status !== 'CANCELLED'
  const preview = quote.status === 'DRAFT'
  const error = failure?.error
  const conflict = error instanceof ApiError && error.status === 409
  return <section aria-labelledby="quote-documents-title" className="space-y-4 rounded-md border border-border-default bg-surface-primary p-4 sm:p-6" aria-busy={pending}>
    <h2 id="quote-documents-title" className="text-section-title font-semibold">Documentos</h2>
    <p className="text-text-secondary">{preview ? 'A prévia não altera a situação nem registra geração no histórico.' : 'Cada geração disponível registra um evento no histórico, sem alterar a situação do orçamento.'}</p>
    {!commercial && !production && <p>Nenhum documento disponível nesta situação.</p>}
    <div className="flex flex-wrap gap-3">
      {commercial && <>
        <Button disabled={pending} onClick={() => { void generate('commercial', 'open') }}>{preview ? 'Prévia do PDF' : 'Gerar PDF'}</Button>
        <Button variant="secondary" disabled={pending} onClick={() => { void generate('commercial', 'download') }}>{preview ? 'Baixar prévia do PDF' : 'Baixar PDF'}</Button>
      </>}
      {production && <>
        <Button disabled={pending} onClick={() => { void generate('production', 'open') }}>Ordem de produção</Button>
        <Button variant="secondary" disabled={pending} onClick={() => { void generate('production', 'download') }}>Baixar ordem de produção</Button>
      </>}
    </div>
    {pending && <p role="status" className="flex items-center gap-2"><Spinner />Preparando documento…</p>}
    {notice && <p role="status">{notice}</p>}
    {failure && <ErrorState message={error instanceof ApiError ? error.message : GENERIC_ERROR_MESSAGE} />}
    {conflict && failure?.kind === 'commercial' && error.message === getKnownErrorMessage('Business data is not configured') && <Link className="inline-flex min-h-11 items-center text-brand-navy underline" to="/configuracoes/dados-do-negocio">Configurar dados do negócio</Link>}
    {conflict && error.message === getKnownErrorMessage('Document data is incomplete') && <p>Confira os dados em {failure?.kind === 'production' ? 'Cortinas (ambiente, material e medidas)' : 'Cliente, Cortinas, Condições comerciais e Datas do orçamento'} no detalhe do orçamento antes de tentar novamente.</p>}
  </section>
}
