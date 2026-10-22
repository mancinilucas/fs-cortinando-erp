import { useFieldArray } from 'react-hook-form'
import type { UseFormReturn } from 'react-hook-form'
import { Button } from '@/shared/components/Button'
import { TextField } from '@/shared/components/FormFields'
import { formatMoney } from '@/shared/format/money'
import { DecimalInput } from './DecimalInput'
import { MoneyInput } from './MoneyInput'
import type { QuoteFormValues } from './quote-form'
import type { QuoteGeneralAddOn } from './types'

export function GeneralAddOnsEditor({ form, confirmed = [] }: { form: UseFormReturn<QuoteFormValues>; confirmed?: QuoteGeneralAddOn[] }) {
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: 'generalAddOns' })
  return <section aria-labelledby="add-ons-title" className="space-y-4 rounded-md border border-border-default bg-surface-primary p-4 sm:p-6">
    <h2 id="add-ons-title" className="text-section-title font-semibold">Adicionais gerais</h2>
    <Button variant="secondary" onClick={() => append({ name: '', quantity: '', unit: '', unitPrice: '' })}>Adicionar adicional geral</Button>
    {fields.length === 0 && <p className="text-text-secondary">Nenhum adicional geral adicionado.</p>}
    {fields.map((field, index) => {
      const path = `generalAddOns.${index}` as const
      const errors = form.formState.errors.generalAddOns?.[index]
      const saved = confirmed.find((item) => item.id === field.serverId)
      return <fieldset key={field.id} className="min-w-0 space-y-4 border-t border-border-default pt-4">
        <legend className="font-semibold">Adicional geral {index + 1}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Nome do adicional (obrigatório)" {...form.register(`${path}.name`)} error={errors?.name?.message} />
          <TextField label="Unidade do adicional" {...form.register(`${path}.unit`)} error={errors?.unit?.message} />
          <DecimalInput label="Quantidade do adicional" decimalPlaces={6} rules={{ strictlyPositive: true, max: 999999.999999 }} {...form.register(`${path}.quantity`)} error={errors?.quantity?.message} />
          <MoneyInput label="Preço unitário do adicional (R$)" rules={{ strictlyPositive: true }} {...form.register(`${path}.unitPrice`)} error={errors?.unitPrice?.message} />
        </div>
        {saved?.totalCents != null && <p className="text-label text-text-secondary">Total salvo do adicional: {formatMoney(saved.totalCents)}</p>}
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" disabled={index === 0} onClick={() => move(index, index - 1)}>Subir adicional</Button>
          <Button variant="secondary" disabled={index === fields.length - 1} onClick={() => move(index, index + 1)}>Descer adicional</Button>
          <Button variant="destructive" onClick={() => remove(index)}>Remover adicional</Button>
        </div>
      </fieldset>
    })}
  </section>
}
