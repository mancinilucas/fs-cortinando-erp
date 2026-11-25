import { Button } from '@/shared/components/Button'
import { TextField } from '@/shared/components/FormFields'
import { formatMoney } from '@/shared/format/money'
import { DecimalInput } from './DecimalInput'
import { MoneyInput } from './MoneyInput'
import type { FinancialFieldArray } from './financial-form'
import type { QuoteFormValues } from './quote-form'
import type { QuoteFinancialItem } from './types'
import type { UseFormReturn } from 'react-hook-form'

// General add-ons are the financial items whose `curtainId` is null. They share
// the quote's single `financialItems` collection with the curtain components.
export function GeneralAddOnsEditor({ form, financial, confirmed = [] }: {
  form: UseFormReturn<QuoteFormValues>; financial: FinancialFieldArray; confirmed?: QuoteFinancialItem[]
}) {
  const rows = financial.fields.map((field, index) => ({ field, index })).filter(({ field }) => field.curtainKey === null)
  const siblingIndices = rows.map(({ index }) => index)
  const savedFor = (serverId?: string) => serverId ? confirmed.find((item) => item.id === serverId) : undefined
  return <section aria-labelledby="add-ons-title" className="space-y-4 rounded-md border border-border-default bg-surface-primary p-4 sm:p-6">
    <h2 id="add-ons-title" className="text-section-title font-semibold">Adicionais gerais</h2>
    <Button variant="secondary" onClick={() => financial.append({ curtainKey: null, name: '', quantity: '', unit: '', unitPrice: '' })}>Adicionar adicional geral</Button>
    {rows.length === 0 && <p className="text-text-secondary">Nenhum adicional geral adicionado.</p>}
    {rows.map(({ field, index }, position) => {
      const prefix = `financialItems.${index}` as const
      const errors = form.formState.errors.financialItems?.[index]
      const saved = savedFor(field.serverId)
      return <fieldset key={field.id} className="min-w-0 space-y-4 border-t border-border-default pt-4">
        <legend className="font-semibold">Adicional geral {position + 1}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Nome do adicional (obrigatório)" {...form.register(`${prefix}.name`)} error={errors?.name?.message ? 'Informe o nome do adicional.' : undefined} />
          <TextField label="Unidade do adicional" {...form.register(`${prefix}.unit`)} error={errors?.unit?.message} />
          <DecimalInput label="Quantidade do adicional" decimalPlaces={6} rules={{ strictlyPositive: true, max: 999999.999999 }} {...form.register(`${prefix}.quantity`)} error={errors?.quantity?.message} />
          <MoneyInput label="Preço unitário do adicional (R$)" rules={{ strictlyPositive: true }} {...form.register(`${prefix}.unitPrice`)} error={errors?.unitPrice?.message} />
        </div>
        {saved?.totalCents != null && <p className="text-label text-text-secondary">Total salvo do adicional: {formatMoney(saved.totalCents)}</p>}
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" disabled={position === 0} onClick={() => financial.move(index, siblingIndices[position - 1])}>Subir adicional</Button>
          <Button variant="secondary" disabled={position === rows.length - 1} onClick={() => financial.move(index, siblingIndices[position + 1])}>Descer adicional</Button>
          <Button variant="destructive" onClick={() => financial.remove(index)}>Remover adicional</Button>
        </div>
      </fieldset>
    })}
  </section>
}
