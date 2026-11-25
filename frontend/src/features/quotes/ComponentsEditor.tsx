import { Button } from '@/shared/components/Button'
import { TextField } from '@/shared/components/FormFields'
import { formatMoney } from '@/shared/format/money'
import { decimalInputValue } from './curtain-form'
import { DecimalInput } from './DecimalInput'
import { MoneyInput } from './MoneyInput'
import type { FinancialFieldArray, FinancialItemFormValues } from './financial-form'
import type { QuoteFormValues } from './quote-form'
import type { QuoteCurtain, QuoteFinancialItem } from './types'
import type { UseFormReturn } from 'react-hook-form'

// Financial items are grouped under their curtain for visual context, but they
// live in the quote's single `financialItems` collection. The local index is
// the position in that collection; the label counts siblings only.
function isCurtainItem(item: FinancialItemFormValues, curtainKey: string) { return item.curtainKey === curtainKey }

export function ComponentsEditor({ form, financial, curtainKey, confirmed, confirmedItems = [] }: {
  form: UseFormReturn<QuoteFormValues>; financial: FinancialFieldArray; curtainKey: string
  confirmed?: QuoteCurtain; confirmedItems?: QuoteFinancialItem[]
}) {
  const rows = financial.fields.map((field, index) => ({ field, index })).filter(({ field }) => isCurtainItem(field, curtainKey))
  const siblingIndices = rows.map(({ index }) => index)
  const savedFor = (serverId?: string) => serverId ? confirmedItems.find((item) => item.id === serverId) : undefined
  return <div className="space-y-4">
    <h4 className="font-semibold">Componentes financeiros</h4>
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" onClick={() => financial.append({ curtainKey, name: '', quantity: '', unit: '', unitPrice: '' })}>Adicionar componente</Button>
      <Button variant="secondary" disabled={confirmed?.fabricQuantity == null} onClick={() => {
        if (confirmed?.fabricQuantity == null) return
        financial.append({ curtainKey, name: 'Mão de obra', quantity: decimalInputValue(confirmed.fabricQuantity), unit: 'm', unitPrice: '30,00' })
      }}>Adicionar mão de obra</Button>
    </div>
    {confirmed?.fabricQuantity == null && <p className="text-caption text-text-secondary">Salve a cortina com as medidas para obter a quantidade de tecido do servidor antes de adicionar mão de obra.</p>}
    {rows.length === 0 && <p className="text-text-secondary">Nenhum componente adicionado.</p>}
    {rows.map(({ field, index }, position) => {
      const prefix = `financialItems.${index}` as const
      const errors = form.formState.errors.financialItems?.[index]
      const saved = savedFor(field.serverId)
      return <fieldset key={field.id} className="min-w-0 space-y-4 border-t border-border-default pt-4">
        <legend className="text-label font-semibold">Componente {position + 1}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Nome do componente (obrigatório)" {...form.register(`${prefix}.name`)} error={errors?.name?.message ? 'Informe o nome do componente.' : undefined} />
          <TextField label="Unidade" {...form.register(`${prefix}.unit`)} error={errors?.unit?.message} />
          <DecimalInput label="Quantidade" decimalPlaces={6} rules={{ strictlyPositive: true, max: 999999.999999 }} {...form.register(`${prefix}.quantity`)} error={errors?.quantity?.message} />
          <MoneyInput label="Preço unitário (R$)" rules={{ strictlyPositive: true }} {...form.register(`${prefix}.unitPrice`)} error={errors?.unitPrice?.message} />
        </div>
        {saved?.totalCents != null && <p className="text-label text-text-secondary">Total salvo do componente: {formatMoney(saved.totalCents)}</p>}
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" disabled={position === 0} onClick={() => financial.move(index, siblingIndices[position - 1])}>Subir componente</Button>
          <Button variant="secondary" disabled={position === rows.length - 1} onClick={() => financial.move(index, siblingIndices[position + 1])}>Descer componente</Button>
          <Button variant="destructive" onClick={() => financial.remove(index)}>Remover componente</Button>
        </div>
      </fieldset>
    })}
  </div>
}
