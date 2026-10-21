import type { UseFormReturn } from 'react-hook-form'
import { Button } from '@/shared/components/Button'
import { TextField } from '@/shared/components/FormFields'
import type { CustomerAddress } from '@/features/customers/types'
import type { QuoteFormValues } from './quote-form'

export function InstallationAddressEditor({ form, customerAddress }: { form: UseFormReturn<QuoteFormValues>; customerAddress?: CustomerAddress | null }) {
  const fields = [
    ['postalCode', 'CEP', 'postal-code'], ['street', 'Rua', 'address-line1'], ['number', 'Número', 'off'],
    ['complement', 'Complemento', 'address-line2'], ['neighborhood', 'Bairro', 'off'], ['city', 'Cidade', 'address-level2'], ['state', 'UF', 'address-level1'],
  ] as const
  return <section aria-labelledby="installation-address-title" className="space-y-4 rounded-md border border-border-default bg-surface-primary p-4 sm:p-6">
    <h2 id="installation-address-title" className="text-section-title font-semibold">Endereço de instalação</h2>
    <p className="text-caption text-text-secondary">O rascunho pode ter endereço vazio ou parcial.</p>
    <Button variant="secondary" disabled={!customerAddress} onClick={() => {
      if (!customerAddress) return
      for (const [key] of fields) form.setValue(key, customerAddress[key] ?? '', { shouldDirty: true, shouldValidate: true })
    }}>Usar endereço do cliente</Button>
    {!customerAddress && <p className="text-caption text-text-secondary">Cliente sem endereço cadastrado.</p>}
    <div className="grid gap-4 sm:grid-cols-2">{fields.map(([key, label, autoComplete]) => <TextField key={key} label={label} autoComplete={autoComplete} {...form.register(key)} error={form.formState.errors[key]?.message} />)}</div>
  </section>
}
