import { Select } from '@/shared/components/FormFields'
import { quoteStatusLabels } from '@/shared/format/labels'
import type { QuoteSearch } from './types'

export function StatusFilter({ value, onChange }: { value: QuoteSearch['status']; onChange: (value: QuoteSearch['status']) => void }) {
  return <Select label="Situação" value={value ?? ''} onChange={(event) => onChange(event.target.value ? event.target.value as QuoteSearch['status'] : undefined)}>
    <option value="">Todas as situações</option>
    {Object.entries(quoteStatusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
  </Select>
}
