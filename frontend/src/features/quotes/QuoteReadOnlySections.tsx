import { formatDateTime } from '@/shared/format/dates'
import { formatMeasure, formatQuantity } from '@/shared/format/decimals'
import { formatMoney } from '@/shared/format/money'
import type { QuoteComponent, QuoteCurtain, QuoteDetail } from './types'

export function DetailFields({ values }: { values: ReadonlyArray<readonly [string, string | null]> }) {
  return <dl className="grid min-w-0 gap-4 sm:grid-cols-2">{values.map(([label, value]) => <div key={label} className="min-w-0">
    <dt className="text-label text-text-secondary">{label}</dt><dd className="whitespace-pre-wrap break-words">{value ?? 'Não informado'}</dd>
  </div>)}</dl>
}
const measure = (value: number | null) => value === null ? null : formatMeasure(value)
const quantity = (value: number | null) => value === null ? null : formatQuantity(value)
const money = (value: number | null) => value === null ? null : formatMoney(value)

export function FinancialItems({ items }: { items: QuoteComponent[] }) {
  return <ul className="divide-y divide-border-default">{items.map((item) => <li key={item.id} className="space-y-3 py-4">
    <p className="break-words font-semibold">{item.name}</p>
    <DetailFields values={[
      ['Quantidade', quantity(item.quantity)], ['Unidade', item.unit], ['Preço unitário', money(item.unitPriceCents)], ['Total do item', money(item.totalCents)],
    ]} />
  </li>)}</ul>
}
export function QuoteCurtains({ curtains }: { curtains: QuoteCurtain[] }) {
  return <section aria-labelledby="quote-curtains-title" className="space-y-4 rounded-md border border-border-default bg-surface-primary p-4 sm:p-6">
    <h2 id="quote-curtains-title" className="text-section-title font-semibold">Cortinas</h2>
    {curtains.length === 0 ? <p className="text-text-secondary">Nenhuma cortina cadastrada.</p>
      : <ul className="divide-y divide-border-default">{curtains.map((curtain) => <li key={curtain.id} className="space-y-4 py-4">
        <h3 className="font-semibold">Cortina {curtain.sequence}</h3>
        <DetailFields values={[
          ['Ambiente', curtain.room], ['Descrição', curtain.description], ['Material', curtain.material],
          ['Largura do vão (m)', measure(curtain.openingWidth)], ['Borda (m)', measure(curtain.borderValue)],
          ['Largura final (m)', measure(curtain.finalWidth)], ['Altura (m)', measure(curtain.height)],
          ['Fator de tecido', measure(curtain.fabricFactor)], ['Quantidade de tecido (m)', quantity(curtain.fabricQuantity)],
          ['Observações da cortina', curtain.notes], ['Total da cortina', money(curtain.totalCents)],
        ]} />
        <h4 className="font-semibold">Componentes financeiros</h4>
        {curtain.components.length === 0 ? <p className="text-text-secondary">Nenhum componente cadastrado.</p> : <FinancialItems items={curtain.components} />}
      </li>)}</ul>}
  </section>
}
export function QuoteDates({ quote }: { quote: QuoteDetail }) {
  return <section aria-labelledby="quote-dates-title" className="space-y-4 rounded-md border border-border-default bg-surface-primary p-4 sm:p-6">
    <h2 id="quote-dates-title" className="text-section-title font-semibold">Datas do orçamento</h2>
    <DetailFields values={([
      ['createdAt', 'Criação'], ['updatedAt', 'Última atualização'], ['firstSentAt', 'Primeiro envio'],
      ['validUntil', 'Validade'], ['confirmedAt', 'Confirmação'], ['productionStartedAt', 'Início da produção'], ['completedAt', 'Conclusão'],
    ] as const).map(([key, label]) => [label, quote[key] === null ? null : formatDateTime(quote[key])])} />
  </section>
}
