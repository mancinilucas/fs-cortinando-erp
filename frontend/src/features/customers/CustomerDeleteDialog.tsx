import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ApiError } from '@/shared/api/api-error'
import { Button } from '@/shared/components/Button'
import { Dialog } from '@/shared/components/Dialog'
import { ErrorState, Spinner } from '@/shared/components/States'
import { GENERIC_ERROR_MESSAGE } from '@/shared/errors/error-messages'
import { useDeleteCustomer } from './hooks'
import type { CustomerDetail } from './types'

export function CustomerDeleteDialog({ customer, onClose }: { customer: CustomerDetail; onClose: () => void }) {
  const mutation = useDeleteCustomer()
  const navigate = useNavigate()
  const locked = useRef(false)
  const [error, setError] = useState<string>()
  async function remove() {
    if (locked.current) return
    locked.current = true
    setError(undefined)
    try {
      await mutation.mutateAsync(customer.id)
      void navigate('/clientes', { replace: true })
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : GENERIC_ERROR_MESSAGE)
    } finally { locked.current = false }
  }
  return <Dialog open onClose={() => { if (!locked.current) onClose() }} title="Excluir cliente" description={`Deseja excluir ${customer.name}? Os orçamentos vinculados serão preservados.`}>
    {error && <ErrorState message={error} />}
    <div aria-busy={mutation.isPending} className="flex flex-wrap gap-3">
      <Button variant="secondary" disabled={mutation.isPending} onClick={onClose}>Cancelar</Button>
      <Button variant="destructive" disabled={mutation.isPending} onClick={() => { void remove() }}>{mutation.isPending && <Spinner />}{mutation.isPending ? 'Excluindo…' : 'Confirmar exclusão'}</Button>
    </div>
  </Dialog>
}
