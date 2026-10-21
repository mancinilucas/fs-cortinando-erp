import { ClockAlert } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useCustomer } from '@/features/customers/hooks'
import { ApiError } from '@/shared/api/api-error'
import { ErrorState, LoadingState } from '@/shared/components/States'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { formatDateTime } from '@/shared/format/dates'
import { formatQuantity } from '@/shared/format/decimals'
import { formatMoney } from '@/shared/format/money'
import { discountTypeLabels } from '@/shared/format/labels'
import { useQuote } from './hooks'
import { QuoteHistory } from './QuoteHistory'
import { DetailFields, FinancialItems, QuoteCurtains, QuoteDates } from './QuoteReadOnlySections'
import { TotalsSummary } from './TotalsSummary'

const section = 'space-y-4 rounded-md border border-border-default bg-surface-primary p-4 sm:p-6'
export function QuoteDetailPage() {
  const { quoteId } = useParams()
  const query = useQuote(quoteId)
  const customer = useCustomer(query.data?.customerId)
  const missing = query.error instanceof ApiError && query.error.status === 404
  const customerMissing = customer.error instanceof ApiError && customer.error.status === 404
  const quote = query.data
  return <div className="space-y-6">
    <Link to="/orcamentos" className="inline-flex min-h-11 items-center text-brand-navy underline">Voltar</Link>
    {query.isPending ? <LoadingState label="Carregando orçamento…" />
      : missing || !quote ? <ErrorState message={missing ? 'Orçamento não encontrado.' : query.error instanceof ApiError ? query.error.message : GENERIC_ERROR_MESSAGE} onRetry={missing ? undefined : () => { void query.refetch() }} />
        : <>
          {query.isError && <ErrorState message={query.error instanceof ApiError ? query.error.message : GENERIC_ERROR_MESSAGE} onRetry={() => { void query.refetch() }} />}
          <section aria-label="Resumo do orçamento" className={section}>
            <h2 className="break-words text-section-title font-semibold">{quote.quoteNumber}</h2>
            <div className="flex flex-wrap gap-2"><StatusBadge status={quote.status} />{quote.expired && <StatusBadge status="EXPIRED" />}</div>
            <DetailFields values={[["Observações", quote.notes]]} />
          </section>
          <section aria-label="Cliente do orçamento" className={section}>
            <h2 className="text-section-title font-semibold">Cliente</h2>
            {customer.isPending ? <LoadingState label="Carregando cliente…" /> : customer.data && !customerMissing ? <>
              <DetailFields values={[["Nome", customer.data.name], ["Telefone", customer.data.phone], ["E-mail", customer.data.email], ["CPF/CNPJ", customer.data.taxId]]} />
              <Link to={`/clientes/${encodeURIComponent(quote.customerId)}`} className="inline-flex min-h-11 items-center text-brand-navy underline">Abrir cliente</Link>
            </> : customerMissing ? <p className="text-text-secondary">Cadastro do cliente indisponível. O orçamento foi preservado.</p>
              : <ErrorState message={customer.error instanceof ApiError ? customer.error.message : GENERIC_ERROR_MESSAGE} onRetry={() => { void customer.refetch() }} />}
          </section>
          <section aria-labelledby="quote-installation-title" className={section}>
            <h2 id="quote-installation-title" className="text-section-title font-semibold">Instalação</h2>
            <DetailFields values={[["Data agendada", quote.scheduledInstallationAt ? formatDateTime(quote.scheduledInstallationAt) : null]]} />
            {quote.lateInstallation && <p role="status" className="flex items-center gap-2 text-warning-fg"><ClockAlert aria-hidden="true" size={20} />Instalação em atraso</p>}
            {quote.installationAddress ? <DetailFields values={[
              ['CEP', quote.installationAddress.postalCode], ['Rua', quote.installationAddress.street], ['Número', quote.installationAddress.number],
              ['Complemento', quote.installationAddress.complement], ['Bairro', quote.installationAddress.neighborhood], ['Cidade', quote.installationAddress.city], ['UF', quote.installationAddress.state],
            ]} /> : <p className="text-text-secondary">Endereço de instalação não informado.</p>}
          </section>
          <QuoteCurtains curtains={quote.curtains} />
          <section aria-labelledby="quote-additions-title" className={section}>
            <h2 id="quote-additions-title" className="text-section-title font-semibold">Adicionais gerais</h2>
            {quote.generalAddOns.length === 0 ? <p className="text-text-secondary">Nenhum adicional geral cadastrado.</p> : <FinancialItems items={quote.generalAddOns} />}
          </section>
          <section aria-labelledby="quote-commercial-title" className={section}>
            <h2 id="quote-commercial-title" className="text-section-title font-semibold">Condições comerciais</h2>
            <DetailFields values={[
              ['Desconto', discountTypeLabels[quote.discount.type]],
              ['Percentual', quote.discount.percentage === null ? null : `${formatQuantity(quote.discount.percentage)}%`],
              ['Desconto fixo', quote.discount.fixedAmountCents === null ? null : formatMoney(quote.discount.fixedAmountCents)],
              ['Ajuste comercial', quote.commercialAdjustmentCents === null ? null : formatMoney(quote.commercialAdjustmentCents)],
            ]} />
          </section>
          <TotalsSummary totals={quote.totals} />
          <QuoteDates quote={quote} />
          <div data-quote-actions>{(quote.status === 'DRAFT' || quote.status === 'SENT') && <Link to={`/orcamentos/${encodeURIComponent(quote.id)}/editar`} className="inline-flex min-h-11 items-center rounded-sm bg-brand-navy px-4 py-2 text-button font-semibold text-text-inverse">Editar orçamento</Link>}</div>
          <div data-quote-documents />
          <QuoteHistory quoteId={quote.id} />
        </>}
  </div>
}
