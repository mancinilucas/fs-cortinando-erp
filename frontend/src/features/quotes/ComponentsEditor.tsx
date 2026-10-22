import { useFieldArray } from 'react-hook-form'
import type { UseFormReturn } from 'react-hook-form'
import { Button } from '@/shared/components/Button'
import { TextField } from '@/shared/components/FormFields'
import { formatMoney } from '@/shared/format/money'
import { decimalInputValue } from './curtain-form'
import { DecimalInput } from './DecimalInput'
import { MoneyInput } from './MoneyInput'
import type { QuoteFormValues } from './quote-form'
import type { QuoteCurtain } from './types'

export function ComponentsEditor({ form, index, confirmed }: { form: UseFormReturn<QuoteFormValues>; index: number; confirmed?: QuoteCurtain }) {
  const path = `curtains.${index}.components` as const
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: path })
  return <div className="space-y-4">
    <h4 className="font-semibold">Componentes financeiros</h4>
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" onClick={() => append({ name: '', quantity: '', unit: '', unitPrice: '' })}>Adicionar componente</Button>
      <Button variant="secondary" disabled={confirmed?.fabricQuantity == null} onClick={() => {
        if (confirmed?.fabricQuantity == null) return
        append({ name: 'Mão de obra', quantity: decimalInputValue(confirmed.fabricQuantity), unit: 'm', unitPrice: '30,00' })
      }}>Adicionar mão de obra</Button>
    </div>
    {confirmed?.fabricQuantity == null && <p className="text-caption text-text-secondary">Salve a cortina com as medidas para obter a quantidade de tecido do servidor antes de adicionar mão de obra.</p>}
    {fields.length === 0 && <p className="text-text-secondary">Nenhum componente adicionado.</p>}
    {fields.map((field, componentIndex) => {
      const prefix = `${path}.${componentIndex}` as const
      const errors = form.formState.errors.curtains?.[index]?.components?.[componentIndex]
      const saved = confirmed?.components.find((component) => component.id === field.serverId)
      return <fieldset key={field.id} className="min-w-0 space-y-4 border-t border-border-default pt-4">
        <legend className="text-label font-semibold">Componente {componentIndex + 1}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Nome do componente (obrigatório)" {...form.register(`${prefix}.name`)} error={errors?.name?.message} />
          <TextField label="Unidade" {...form.register(`${prefix}.unit`)} error={errors?.unit?.message} />
          <DecimalInput label="Quantidade" decimalPlaces={6} rules={{ strictlyPositive: true, max: 999999.999999 }} {...form.register(`${prefix}.quantity`)} error={errors?.quantity?.message} />
          <MoneyInput label="Preço unitário (R$)" rules={{ strictlyPositive: true }} {...form.register(`${prefix}.unitPrice`)} error={errors?.unitPrice?.message} />
        </div>
        {saved?.totalCents != null && <p className="text-label text-text-secondary">Total salvo do componente: {formatMoney(saved.totalCents)}</p>}
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" disabled={componentIndex === 0} onClick={() => move(componentIndex, componentIndex - 1)}>Subir componente</Button>
          <Button variant="secondary" disabled={componentIndex === fields.length - 1} onClick={() => move(componentIndex, componentIndex + 1)}>Descer componente</Button>
          <Button variant="destructive" onClick={() => remove(componentIndex)}>Remover componente</Button>
        </div>
      </fieldset>
    })}
  </div>
}
