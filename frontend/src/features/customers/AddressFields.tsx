import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { TextField } from '@/shared/components/FormFields'
import type { CustomerFormValues } from './customer-form'

export function AddressFields({ register, errors }: { register: UseFormRegister<CustomerFormValues>; errors: FieldErrors<CustomerFormValues> }) {
  return <div className="grid gap-4 sm:grid-cols-2">
    <TextField label="Rua (obrigatório)" required autoComplete="address-line1" {...register('street')} error={errors.street?.message} />
    <TextField label="Número (obrigatório)" required {...register('number')} error={errors.number?.message} />
    <TextField label="Bairro (obrigatório)" required {...register('neighborhood')} error={errors.neighborhood?.message} />
    <TextField label="Cidade (obrigatório)" required autoComplete="address-level2" {...register('city')} error={errors.city?.message} />
    <TextField label="CEP" inputMode="numeric" autoComplete="postal-code" {...register('postalCode')} error={errors.postalCode?.message} />
    <TextField label="UF" autoComplete="address-level1" {...register('state')} error={errors.state?.message} />
    <div className="sm:col-span-2"><TextField label="Complemento" autoComplete="address-line2" {...register('complement')} error={errors.complement?.message} /></div>
  </div>
}
