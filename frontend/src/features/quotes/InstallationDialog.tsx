import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ApiError } from '@/shared/api/api-error'
import { Button } from '@/shared/components/Button'
import { Dialog } from '@/shared/components/Dialog'
import { TextField } from '@/shared/components/FormFields'
import { ErrorState, Spinner } from '@/shared/components/States'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { useToast } from '@/shared/components/toast-context'
import { formatDateTime } from '@/shared/format/dates'
import { quoteStatusLabels } from '@/shared/format/labels'
import { isoToLocalDateTime, localDateTimeToIso } from './local-date-time'
import { QuoteGateErrors } from './QuoteGateErrors'
import type { QuoteDetail } from './types'
import { useInstallation } from './use-installation'

const schema = z.object({ instant: z.string().min(1, 'Informe a data e hora da instalação.').superRefine((value, context) => {
  if (!value) return
  try { localDateTimeToIso(value) }
  catch { context.addIssue({ code: 'custom', message: 'Informe data e hora válidas.' }) }
}) })
export function InstallationDialog({ quote, mode, onClose }: { quote: QuoteDetail; mode: 'schedule' | 'remove'; onClose: () => void }) {
  const toast = useToast()
  const mutation = useInstallation(quote)
  const locked = useRef(false)
  const [failure, setFailure] = useState<unknown>()
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ defaultValues: { instant: quote.scheduledInstallationAt ? isoToLocalDateTime(quote.scheduledInstallationAt) : '' } })
  const pending = mutation.isPending || isSubmitting
  const permitted = (quote.status === 'CONFIRMED' || quote.status === 'IN_PRODUCTION') && (mode === 'schedule' || quote.scheduledInstallationAt !== null)
  async function submit(values: { instant: string }) {
    if (locked.current || !permitted) return
    if (mode === 'schedule') {
      const parsed = schema.safeParse(values)
      if (!parsed.success) { setError('instant', { message: parsed.error.issues[0].message }, { shouldFocus: true }); return }
    }
    locked.current = true; setFailure(undefined)
    try {
      await mutation.mutateAsync(mode === 'remove' ? { action: 'remove' } : { action: 'schedule', scheduledInstallationAt: localDateTimeToIso(values.instant) })
      toast.success(mode === 'remove' ? 'Agendamento removido.' : 'Instalação agendada.')
      onClose()
    } catch (error) { setFailure(error) }
    finally { locked.current = false }
  }
  const close = () => { if (!locked.current && !pending) onClose() }
  const title = mode === 'remove' ? 'Remover instalação' : quote.scheduledInstallationAt ? 'Alterar instalação' : 'Agendar instalação'
  const description = mode === 'remove'
    ? `${quote.quoteNumber}: deseja remover o agendamento${quote.scheduledInstallationAt ? ` de ${formatDateTime(quote.scheduledInstallationAt)}` : ''}? O orçamento será preservado.`
    : `${quote.quoteNumber}: informe a data e hora da instalação. Datas passadas são permitidas.`
  return <Dialog open title={title} description={description} onClose={close}>
    <form noValidate aria-busy={pending} className="space-y-4" onSubmit={(event) => { void handleSubmit(submit)(event) }}>
      {mode === 'schedule' && <fieldset disabled={pending} className="min-w-0">
        <TextField type="datetime-local" step="0.001" label="Data e hora da instalação (obrigatórias)" hint="Horário de Brasília. Datas passadas são permitidas." {...register('instant')} error={errors.instant?.message} />
      </fieldset>}
      {failure !== undefined && <>
        <ErrorState message={failure instanceof ApiError ? failure.message : GENERIC_ERROR_MESSAGE} />
        {failure instanceof ApiError && failure.status === 409 && <p role="status">Situação conhecida: {quoteStatusLabels[quote.status]}. Confira os dados antes de tentar novamente.</p>}
        {failure instanceof ApiError && failure.status === 422 && <QuoteGateErrors violations={failure.violations} />}
      </>}
      {!permitted && !pending && <p role="status">Esta ação não está disponível na situação atual.</p>}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled={pending} onClick={close}>Cancelar</Button>
        <Button type="submit" variant={mode === 'remove' ? 'destructive' : 'primary'} disabled={pending || !permitted}>{pending && <Spinner />}{pending ? 'Processando…' : mode === 'remove' ? 'Confirmar remoção' : 'Salvar agendamento'}</Button>
      </div>
    </form>
  </Dialog>
}
