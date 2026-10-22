import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '@/shared/api/api-error'
import { Button } from '@/shared/components/Button'
import { FieldError, TextArea, TextField } from '@/shared/components/FormFields'
import { ErrorState, LoadingState, Spinner } from '@/shared/components/States'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { useToast } from '@/shared/components/toast-context'
import { AddressFields } from './AddressFields'
import { customerFormDefaults, customerFormPatch, customerFormPayload, customerFormResolver } from './customer-form'
import type { CustomerFormValues } from './customer-form'
import { useCreateCustomer, useCustomer, useUpdateCustomer } from './hooks'
import type { CustomerDetail } from './types'

function CustomerForm({ customer }: { customer?: CustomerDetail }) {
  const navigate = useNavigate()
  const toast = useToast()
  const baseline = useRef(customerFormDefaults(customer))
  const mounted = useRef(false)
  const locked = useRef(false)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const create = useCreateCustomer()
  const update = useUpdateCustomer(customer?.id ?? '')
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<CustomerFormValues>({
    resolver: customerFormResolver, defaultValues: customerFormDefaults(customer),
  })
  const addressEnabled = useWatch({ control, name: 'addressEnabled' })
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function submit(values: CustomerFormValues) {
    if (locked.current) return
    const patch = customerFormPatch(values, baseline.current)
    if (customer && Object.keys(patch).length === 0) { setNotice('Não há alterações para salvar.'); return }
    locked.current = true
    setError(undefined); setNotice(undefined)
    try {
      const saved = customer ? await update.mutateAsync(patch) : await create.mutateAsync(customerFormPayload(values))
      if (!mounted.current) return
      baseline.current = customerFormDefaults(saved)
      reset(baseline.current)
      toast.success(customer ? 'Cliente atualizado.' : 'Cliente cadastrado.')
      if (!customer) { void navigate(`/clientes/${encodeURIComponent(saved.id)}`, { replace: true }) }
    } catch (failure) {
      if (mounted.current) {
        if (failure instanceof ApiError && failure.status === 401) return
        if (failure instanceof ApiError && [400, 422].includes(failure.status)) setError(failure.message)
        else toast.error(failure instanceof ApiError ? failure.message : GENERIC_ERROR_MESSAGE)
      }
    } finally { locked.current = false }
  }
  const backTo = customer ? `/clientes/${encodeURIComponent(customer.id)}` : '/clientes'
  return <div className="max-w-190 space-y-6">
    <Link to={backTo} className="inline-flex min-h-11 items-center text-brand-navy underline">Voltar</Link>
    <form noValidate onChange={() => setNotice(undefined)} onSubmit={(event) => { void handleSubmit(submit)(event) }} aria-busy={isSubmitting} className="space-y-6">
      <fieldset disabled={isSubmitting} className="min-w-0 space-y-6 rounded-md border border-border-default bg-surface-primary p-4 sm:p-6">
        <legend className="px-2 text-section-title font-semibold">Dados do cliente</legend>
        <p className="text-caption text-text-secondary">Campos obrigatórios estão identificados nos rótulos.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Nome (obrigatório)" required autoComplete="name" {...register('name')} error={errors.name?.message} />
          <TextField label="Telefone (obrigatório)" required type="tel" autoComplete="tel" {...register('phone')} error={errors.phone?.message} />
          <TextField label="E-mail" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
          <TextField label="CPF/CNPJ" inputMode="numeric" {...register('taxId')} error={errors.taxId?.message} />
        </div>
        <TextArea label="Observações" {...register('notes')} error={errors.notes?.message} />
        <div className="space-y-4 border-t border-border-default pt-4">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-label font-medium">
            <input type="checkbox" role="switch" {...register('addressEnabled')} className="h-5 w-5 accent-brand-navy" />Adicionar endereço
          </label>
          {addressEnabled && <>
            <AddressFields register={register} errors={errors} />
            <p className="text-caption text-text-secondary">Para remover o endereço, desative “Adicionar endereço”.</p>
          </>}
        </div>
      </fieldset>
      {error && <FieldError>{error}</FieldError>}
      {notice && <p role="status" className="text-body text-text-secondary">{notice}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isSubmitting || Boolean(customer && !isDirty)}>{isSubmitting && <Spinner />}{isSubmitting ? 'Salvando…' : customer ? 'Salvar alterações' : 'Criar cliente'}</Button>
        <Link to={backTo} className="inline-flex min-h-11 items-center px-3 text-brand-navy underline">Cancelar</Link>
      </div>
    </form>
  </div>
}

export function CustomerFormPage() {
  const { customerId } = useParams()
  const query = useCustomer(customerId)
  if (!customerId) return <CustomerForm key="create" />
  if (query.isPending) return <LoadingState label="Carregando cliente…" />
  if (!query.data) return <div><Link to="/clientes" className="inline-flex min-h-11 items-center text-brand-navy underline">Voltar</Link>
    <ErrorState message={query.error instanceof ApiError ? query.error.message : GENERIC_ERROR_MESSAGE} onRetry={() => { void query.refetch() }} /></div>
  return <CustomerForm key={customerId} customer={query.data} />
}
