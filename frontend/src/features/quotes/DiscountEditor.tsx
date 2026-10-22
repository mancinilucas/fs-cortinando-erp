import { useWatch } from 'react-hook-form'
import type { UseFormReturn } from 'react-hook-form'
import { Select } from '@/shared/components/FormFields'
import { discountTypeLabels } from '@/shared/format/labels'
import { DecimalInput } from './DecimalInput'
import { MoneyInput } from './MoneyInput'
import type { QuoteFormValues } from './quote-form'

export function DiscountEditor({ form }: { form: UseFormReturn<QuoteFormValues> }) {
  const type = useWatch({ control: form.control, name: 'discountType' })
  const errors = form.formState.errors
  return <section aria-labelledby="discount-title" className="space-y-4 rounded-md border border-border-default bg-surface-primary p-4 sm:p-6">
    <h2 id="discount-title" className="text-section-title font-semibold">Condições comerciais</h2>
    <Select label="Tipo de desconto" {...form.register('discountType')}>
      {Object.entries(discountTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </Select>
    <div className="grid gap-4 sm:grid-cols-2">
      <DecimalInput label="Desconto percentual (%)" decimalPlaces={2} rules={{ strictlyPositive: true, max: 100 }} {...form.register('discountPercentage')} disabled={type !== 'PERCENTAGE'} error={type === 'PERCENTAGE' ? errors.discountPercentage?.message : undefined} />
      <MoneyInput label="Desconto em valor fixo (R$)" rules={{ strictlyPositive: true }} {...form.register('discountFixedAmount')} disabled={type !== 'FIXED_AMOUNT'} error={type === 'FIXED_AMOUNT' ? errors.discountFixedAmount?.message : undefined} />
    </div>
    <MoneyInput label="Ajuste comercial (R$)" rules={{}} hint="Informe um valor positivo ou negativo em reais. O total é calculado pelo servidor após salvar." {...form.register('commercialAdjustment')} error={errors.commercialAdjustment?.message} />
  </section>
}
