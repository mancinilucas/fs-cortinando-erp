import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { ApiError } from '@/shared/api/api-error'
import { Button } from '@/shared/components/Button'
import { Dialog } from '@/shared/components/Dialog'
import { TextArea, TextField } from '@/shared/components/FormFields'
import { ErrorState, Spinner } from '@/shared/components/States'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { quoteActionLabels, quoteStatusLabels } from '@/shared/format/labels'
import { lifecycleActions, lifecycleDescriptions, validityToIso } from './lifecycle'
import type { LifecycleAction } from './lifecycle'
import { QuoteGateErrors } from './QuoteGateErrors'
import type { QuoteDetail } from './types'
import { useQuoteLifecycle } from './use-quote-lifecycle'

function ActionDialog({ action, quote, futureInstallation, onClose }: { action: LifecycleAction; quote: QuoteDetail; futureInstallation: boolean; onClose: () => void }) {
  const mutation = useQuoteLifecycle(quote)
  const navigate = useNavigate()
  const locked = useRef(false)
  const [failure, setFailure] = useState<unknown>()
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ defaultValues: { validity: '', reason: '' } })
  const permitted = lifecycleActions(quote).includes(action) && !(action === 'complete' && futureInstallation)
  const pending = mutation.isPending || isSubmitting
  async function submit(values: { validity: string; reason: string }) {
    if (locked.current || !permitted) return
    let validUntil: string | undefined
    if (action === 'send' || action === 'renew') {
      if (action === 'renew' && !values.validity) { setError('validity', { message: 'Informe a nova validade.' }, { shouldFocus: true }); return }
      if (values.validity) {
        try { validUntil = validityToIso(values.validity) }
        catch { setError('validity', { message: 'Informe data e hora válidas.' }, { shouldFocus: true }); return }
        if (Date.parse(validUntil) <= Date.now()) { setError('validity', { message: 'Informe uma validade futura.' }, { shouldFocus: true }); return }
      }
    }
    if (action === 'cancel' && !z.string().max(500).safeParse(values.reason).success) { setError('reason', { message: 'Use no máximo 500 caracteres.' }, { shouldFocus: true }); return }
    locked.current = true; setFailure(undefined)
    try {
      await mutation.mutateAsync({ action, validUntil, reason: values.reason.trim() || undefined })
      if (action === 'delete') void navigate('/orcamentos', { replace: true })
      else onClose()
    } catch (error) { setFailure(error) }
    finally { locked.current = false }
  }
  return <Dialog open title={quoteActionLabels[action]} description={`${quote.quoteNumber}: ${lifecycleDescriptions[action]}`} onClose={() => { if (!locked.current && !pending) onClose() }}>
    <form noValidate aria-busy={pending} className="space-y-4" onSubmit={(event) => { void handleSubmit(submit)(event) }}>
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        {(action === 'send' || action === 'renew') && <TextField type="datetime-local" label={action === 'renew' ? 'Nova validade (obrigatória)' : 'Validade (opcional)'} hint="Data e hora de Brasília." {...register('validity')} error={errors.validity?.message} />}
        {action === 'cancel' && <TextArea label="Motivo do cancelamento (opcional)" maxLength={500} {...register('reason')} error={errors.reason?.message} />}
      </fieldset>
      {failure !== undefined && <>
        <ErrorState message={failure instanceof ApiError ? failure.message : GENERIC_ERROR_MESSAGE} />
        {failure instanceof ApiError && failure.status === 409 && <p role="status">Situação conhecida: {quoteStatusLabels[quote.expired ? 'EXPIRED' : quote.status]}. Confira os dados antes de tentar novamente.</p>}
        {failure instanceof ApiError && failure.status === 422 && <QuoteGateErrors violations={failure.violations} />}
      </>}
      {!permitted && <p role="status">Esta ação não está disponível na situação atual.</p>}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled={pending} onClick={onClose}>Voltar</Button>
        <Button type="submit" variant={action === 'delete' || action === 'cancel' ? 'destructive' : 'primary'} disabled={pending || !permitted}>{pending && <Spinner />}{pending ? 'Processando…' : 'Confirmar ação'}</Button>
      </div>
    </form>
  </Dialog>
}
export function QuoteActions({ quote }: { quote: QuoteDetail }) {
  const [selected, setSelected] = useState<LifecycleAction>()
  const [now, setNow] = useState(Date.now)
  const scheduled = quote.scheduledInstallationAt ? Date.parse(quote.scheduledInstallationAt) : 0
  const futureInstallation = scheduled > now
  useEffect(() => {
    const update = () => setNow(Date.now())
    window.addEventListener('focus', update)
    const timer = scheduled > now ? setTimeout(update, Math.max(0, Math.min(scheduled - Date.now() + 1, 2147483647))) : undefined
    return () => { clearTimeout(timer); window.removeEventListener('focus', update) }
  }, [scheduled, now])
  const actions = lifecycleActions(quote)
  return <section aria-label="Ações do orçamento" className="space-y-3">
    {actions.length > 0 && <h2 className="text-section-title font-semibold">Ações do orçamento</h2>}
    <div className="flex flex-wrap gap-3">{actions.map((action) => <Button key={action} variant={action === 'delete' || action === 'cancel' ? 'destructive' : 'secondary'} aria-describedby={action === 'complete' && futureInstallation ? 'completion-schedule-hint' : undefined} disabled={selected !== undefined || (action === 'complete' && futureInstallation)} onClick={() => setSelected(action)}>{quoteActionLabels[action]}</Button>)}</div>
    {quote.status === 'IN_PRODUCTION' && futureInstallation && <p id="completion-schedule-hint" className="text-caption text-text-secondary">A conclusão estará disponível após a data e hora da instalação agendada.</p>}
    {selected && <ActionDialog action={selected} quote={quote} futureInstallation={futureInstallation} onClose={() => setSelected(undefined)} />}
  </section>
}
