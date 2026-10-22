import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ApiError } from '@/shared/api/api-error'
import { Button } from '@/shared/components/Button'
import { FieldError, TextField } from '@/shared/components/FormFields'
import { ErrorState, LoadingState, Spinner } from '@/shared/components/States'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { useToast } from '@/shared/components/toast-context'
import { formatDateTime } from '@/shared/format/dates'
import { businessDataFormSchema, type BusinessDataFormValues } from './schema'
import type { Resolver } from 'react-hook-form'
import { useBusinessData, useUpdateBusinessData } from './hooks'
import type { BusinessData } from './types'

function defaults(data?: BusinessData): BusinessDataFormValues {
  return { commercialNameOrConsultant: data?.commercialNameOrConsultant ?? '', phone: data?.phone ?? '', email: data?.email ?? '', taxId: data?.taxId ?? '' }
}

const resolver: Resolver<BusinessDataFormValues> = (values) => {
  const parsed = businessDataFormSchema.safeParse(values)
  if (parsed.success) return { values: parsed.data, errors: {} }
  const errors: Record<string, { type: string; message: string }> = {}
  for (const issue of parsed.error.issues) {
    const field = issue.path[0]
    if (typeof field === 'string' && !errors[field]) errors[field] = { type: issue.code, message: issue.message }
  }
  return { values: {}, errors }
}

function BusinessDataForm({ data }: { data?: BusinessData }) {
  const mounted = useRef(false)
  const locked = useRef(false)
  const toast = useToast()
  const [error, setError] = useState<string>()
  const update = useUpdateBusinessData()
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<BusinessDataFormValues>({ resolver, defaultValues: defaults(data) })
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  async function submit(values: BusinessDataFormValues) {
    if (locked.current) return
    locked.current = true
    setError(undefined)
    try {
      const saved = await update.mutateAsync({
        commercialNameOrConsultant: values.commercialNameOrConsultant.trim(),
        phone: values.phone.trim(),
        email: values.email.trim() || null,
        taxId: values.taxId.trim() || null,
      })
      if (!mounted.current) return
      reset(defaults(saved))
      toast.success('Dados do negócio salvos.')
    } catch (failure) {
      if (mounted.current) {
        if (failure instanceof ApiError && failure.status === 401) return
        if (failure instanceof ApiError && [400, 422].includes(failure.status)) setError(failure.message)
        else toast.error(failure instanceof ApiError ? failure.message : GENERIC_ERROR_MESSAGE)
      }
    } finally { locked.current = false }
  }

  return <form noValidate onSubmit={(event) => { void handleSubmit(submit)(event) }} aria-busy={isSubmitting} className="max-w-190 space-y-6">
    <fieldset disabled={isSubmitting} className="min-w-0 space-y-6 rounded-md border border-border-default bg-surface-primary p-4 sm:p-6">
      <legend className="px-2 text-section-title font-semibold">Identificação do negócio</legend>
      <p className="text-caption text-text-secondary">Informe os dados que identificam seu negócio nos documentos comerciais. Campos obrigatórios estão identificados nos rótulos.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Nome comercial ou da consultora (obrigatório)" required autoComplete="organization" {...register('commercialNameOrConsultant')} error={errors.commercialNameOrConsultant?.message} />
        <TextField label="Telefone (obrigatório)" required type="tel" autoComplete="tel" {...register('phone')} error={errors.phone?.message} />
        <TextField label="E-mail" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
        <TextField label="CPF/CNPJ" inputMode="numeric" {...register('taxId')} error={errors.taxId?.message} />
      </div>
      {data?.updatedAt && <p className="text-caption text-text-secondary">Última atualização: {formatDateTime(data.updatedAt)}</p>}
    </fieldset>
    {error && <FieldError>{error}</FieldError>}
    <Button type="submit" disabled={isSubmitting || !isDirty}>{isSubmitting && <Spinner />}{isSubmitting ? 'Salvando…' : 'Salvar dados'}</Button>
  </form>
}

export function BusinessDataPage() {
  const query = useBusinessData()
  if (query.isPending) return <LoadingState label="Carregando dados do negócio…" />
  if (query.error && !(query.error instanceof ApiError && query.error.status === 404)) return <ErrorState message={query.error instanceof ApiError ? query.error.message : GENERIC_ERROR_MESSAGE} onRetry={() => { void query.refetch() }} />
  const data = query.data
  return <div className="space-y-4">
    {!data && <p className="text-body text-text-secondary">Os dados do negócio ainda não foram configurados. Preencha os campos para começar a usar os documentos comerciais.</p>}
    <BusinessDataForm key={data?.updatedAt ?? 'unconfigured'} data={data} />
  </div>
}
