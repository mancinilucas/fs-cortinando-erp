import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ApiError } from '@/shared/api/api-error'
import { Button } from '@/shared/components/Button'
import { Dialog } from '@/shared/components/Dialog'
import { TextArea } from '@/shared/components/FormFields'
import { ErrorState, Spinner } from '@/shared/components/States'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { useToast } from '@/shared/components/toast-context'
import type { CustomerAddress } from '@/features/customers/types'
import { GeneralAddOnsEditor } from './GeneralAddOnsEditor'
import { DiscountEditor } from './DiscountEditor'
import { TotalsSummary } from './TotalsSummary'
import { CurtainsEditor } from './CurtainsEditor'
import { InstallationAddressEditor } from './InstallationAddressEditor'
import { quoteFormDefaults, quoteFormPayload, quoteFormResolver } from './quote-form'
import type { QuoteFormPayload, QuoteFormValues } from './quote-form'
import type { QuoteDetail } from './types'
import { useUnsavedChanges } from './use-unsaved-changes'

export function QuoteForm({ quote, customerAddress, onSave, onSaved }: {
  quote?: QuoteDetail; customerAddress?: CustomerAddress | null
  onSave: (payload: QuoteFormPayload) => Promise<QuoteDetail>
  onSaved?: (quote: QuoteDetail) => void
}) {
  const form = useForm<QuoteFormValues>({ defaultValues: quoteFormDefaults(quote), resolver: quoteFormResolver })
  const toast = useToast()
  const { isDirty, isSubmitting, errors } = form.formState
  const blocker = useUnsavedChanges(isDirty)
  const locked = useRef(false)
  const baseline = useRef(quoteFormDefaults(quote))
  const [confirmed, setConfirmed] = useState(quote)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const savedForNavigation = useRef<QuoteDetail | undefined>(undefined)
  useEffect(() => {
    if (isDirty || isSubmitting || !savedForNavigation.current) return
    const saved = savedForNavigation.current
    savedForNavigation.current = undefined
    onSaved?.(saved)
  }, [isDirty, isSubmitting, onSaved])
  async function submit(values: QuoteFormValues) {
    if (locked.current) return
    locked.current = true
    setError(undefined); setNotice(undefined)
    try {
      const payload = quoteFormPayload(values, baseline.current)
      if (quote && Object.keys(payload).length === 0) {
        form.reset(baseline.current)
        setNotice('Não há alterações para salvar.')
        return
      }
      const saved = await onSave(payload)
      if (onSaved) savedForNavigation.current = saved
      baseline.current = quoteFormDefaults(saved)
      form.reset(baseline.current)
      setConfirmed(saved)
      toast.success('Rascunho salvo.')
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) return
      if (failure instanceof ApiError && [400, 409, 422].includes(failure.status)) setError(failure.message)
      else toast.error(failure instanceof ApiError ? failure.message : GENERIC_ERROR_MESSAGE)
    }
    finally { locked.current = false }
  }
  return <>
    <form noValidate aria-busy={isSubmitting} onChange={() => setNotice(undefined)} onSubmit={(event) => { void form.handleSubmit(submit)(event) }} className="max-w-190 space-y-6">
      <fieldset disabled={isSubmitting} className="min-w-0 space-y-6">
        <section aria-labelledby="quote-general-title" className="space-y-4 rounded-md border border-border-default bg-surface-primary p-4 sm:p-6">
          <h2 id="quote-general-title" className="text-section-title font-semibold">Dados gerais</h2>
          <TextArea label="Observações" {...form.register('notes')} error={errors.notes?.message} />
        </section>
        <InstallationAddressEditor form={form} customerAddress={customerAddress} />
        <CurtainsEditor form={form} confirmed={confirmed?.curtains} />
        <GeneralAddOnsEditor form={form} confirmed={confirmed?.generalAddOns} />
        <DiscountEditor form={form} />
      </fieldset>
      <TotalsSummary totals={confirmed?.totals} />
      <p className="text-caption text-text-secondary">Salve o rascunho para atualizar os valores calculados.</p>
      {error && <ErrorState message={error} />}
      {notice && !isDirty && <p role="status">{notice}</p>}
      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 flex justify-end border-t border-border-default bg-surface-primary p-3 lg:bottom-0">
        <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting || Boolean(quote && !isDirty)}>{isSubmitting && <Spinner />}{isSubmitting ? 'Salvando…' : 'Salvar rascunho'}</Button>
      </div>
    </form>
    {blocker.state === 'blocked' && <Dialog open title="Descartar alterações?" description="Há alterações não salvas neste orçamento." onClose={() => blocker.reset()}>
      <div className="flex flex-wrap gap-3"><Button variant="secondary" onClick={() => blocker.reset()}>Continuar editando</Button><Button variant="destructive" onClick={() => blocker.proceed()}>Descartar alterações</Button></div>
    </Dialog>}
  </>
}
