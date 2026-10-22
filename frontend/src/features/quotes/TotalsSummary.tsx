import { formatMoney } from '@/shared/format/money'
import type { QuoteTotals } from './types'

export function TotalsSummary({ totals }: { totals?: QuoteTotals }) {
  return <section aria-labelledby="quote-totals-title" className="space-y-4 rounded-md border border-border-default bg-surface-primary p-4 sm:p-6">
    <h2 id="quote-totals-title" className="text-section-title font-semibold">Totais salvos</h2>
    {!totals ? <p className="text-text-secondary">Os totais serão exibidos após salvar o rascunho.</p> : <dl className="space-y-3">
      {([
        ['curtainsSubtotalCents', 'Subtotal das cortinas'], ['generalAddOnsSubtotalCents', 'Subtotal dos adicionais gerais'],
        ['subtotalCents', 'Subtotal'], ['discountValueCents', 'Desconto calculado'], ['calculatedTotalCents', 'Total calculado'],
        ['commercialAdjustmentCents', 'Ajuste comercial salvo'], ['totalCents', 'Total final'],
      ] as const).map(([key, label]) => <div key={key} className="flex flex-wrap justify-between gap-3">
        <dt className={key === 'totalCents' ? 'font-semibold' : 'text-text-secondary'}>{label}</dt>
        <dd className="font-semibold tabular-nums">{formatMoney(totals[key])}</dd>
      </div>)}
    </dl>}
  </section>
}
