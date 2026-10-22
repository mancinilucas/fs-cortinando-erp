import { useFieldArray } from 'react-hook-form'
import type { UseFormReturn } from 'react-hook-form'
import { Button } from '@/shared/components/Button'
import { TextArea, TextField } from '@/shared/components/FormFields'
import { formatMeasure, formatQuantity } from '@/shared/format/decimals'
import { formatMoney } from '@/shared/format/money'
import { ComponentsEditor } from './ComponentsEditor'
import { curtainFormDefaults } from './curtain-form'
import { DecimalInput } from './DecimalInput'
import type { QuoteFormValues } from './quote-form'
import type { QuoteCurtain } from './types'

export function CurtainsEditor({ form, confirmed = [] }: { form: UseFormReturn<QuoteFormValues>; confirmed?: QuoteCurtain[] }) {
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: 'curtains' })
  return <section aria-labelledby="curtains-title" className="space-y-6 rounded-md border border-border-default bg-surface-primary p-4 sm:p-6">
    <h2 id="curtains-title" className="text-section-title font-semibold">Cortinas</h2>
    <Button variant="secondary" onClick={() => append(curtainFormDefaults())}>Adicionar cortina</Button>
    {fields.length === 0 && <p className="text-text-secondary">Nenhuma cortina adicionada.</p>}
    {fields.map((field, index) => {
      const prefix = `curtains.${index}` as const
      const errors = form.formState.errors.curtains?.[index]
      const saved = confirmed.find((curtain) => curtain.id === field.serverId)
      return <fieldset key={field.id} className="min-w-0 space-y-4 border-t border-border-default pt-4">
        <legend className="text-section-title font-semibold">Cortina {index + 1}</legend>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" disabled={index === 0} onClick={() => move(index, index - 1)}>Subir cortina</Button>
          <Button variant="secondary" disabled={index === fields.length - 1} onClick={() => move(index, index + 1)}>Descer cortina</Button>
          <Button variant="destructive" onClick={() => remove(index)}>Remover cortina</Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Ambiente" {...form.register(`${prefix}.room`)} error={errors?.room?.message} />
          <TextField label="Descrição" {...form.register(`${prefix}.description`)} error={errors?.description?.message} />
          <TextField label="Material" {...form.register(`${prefix}.material`)} error={errors?.material?.message} />
          {([
            ['openingWidth', 'Largura do vão (m)', { strictlyPositive: true, max: 999999.999 }],
            ['borderValue', 'Borda (m)', { min: 0, max: 999.999 }],
            ['height', 'Altura (m)', { strictlyPositive: true, max: 999999.999 }],
            ['fabricFactor', 'Fator de tecido', { strictlyPositive: true, max: 999.999 }],
          ] as const).map(([key, label, rules]) => <DecimalInput key={key} label={label} rules={rules} {...form.register(`${prefix}.${key}`)} error={errors?.[key]?.message} />)}
        </div>
        <TextArea label="Observações da cortina" {...form.register(`${prefix}.notes`)} error={errors?.notes?.message} />
        {saved && <div className="space-y-1 text-label text-text-secondary" aria-label="Valores salvos da cortina">
          {saved.finalWidth !== null && <p>Largura final salva: {formatMeasure(saved.finalWidth)} m</p>}
          {saved.fabricQuantity !== null && <p>Quantidade de tecido salva: {formatQuantity(saved.fabricQuantity)} m</p>}
          <p>Total salvo da cortina: {formatMoney(saved.totalCents)}</p>
        </div>}
        <ComponentsEditor key={prefix} form={form} index={index} confirmed={saved} />
      </fieldset>
    })}
  </section>
}
