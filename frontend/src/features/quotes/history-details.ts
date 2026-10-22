import { formatDateTime } from '@/shared/format/dates'
import { formatMeasure, formatQuantity } from '@/shared/format/decimals'
import { formatMoney } from '@/shared/format/money'
import { discountTypeLabels } from '@/shared/format/labels'
import type { QuoteHistoryEntry } from './types'

type Kind = 'text' | 'money' | 'measure' | 'quantity' | 'integer' | 'discount'
const fields: Record<string, readonly [string, Kind]> = {
  notes: ['Observações', 'text'], room: ['Ambiente', 'text'], description: ['Descrição', 'text'], material: ['Material', 'text'],
  name: ['Nome', 'text'], unit: ['Unidade', 'text'], curtain: ['Cortina', 'text'], component: ['Componente', 'text'], generalAddOn: ['Adicional geral', 'text'],
  sequence: ['Posição', 'integer'], openingWidth: ['Largura do vão', 'measure'], borderValue: ['Borda', 'measure'],
  height: ['Altura', 'measure'], fabricFactor: ['Fator de tecido', 'measure'], quantity: ['Quantidade', 'quantity'],
  unitPriceCents: ['Preço unitário', 'money'], commercialAdjustmentCents: ['Ajuste comercial', 'money'],
  discountType: ['Tipo de desconto', 'discount'], discountPercentage: ['Desconto percentual (%)', 'quantity'], discountFixedAmountCents: ['Desconto fixo', 'money'],
  'installationAddress.postalCode': ['CEP de instalação', 'text'], 'installationAddress.street': ['Rua de instalação', 'text'],
  'installationAddress.number': ['Número de instalação', 'text'], 'installationAddress.complement': ['Complemento de instalação', 'text'],
  'installationAddress.neighborhood': ['Bairro de instalação', 'text'], 'installationAddress.city': ['Cidade de instalação', 'text'], 'installationAddress.state': ['UF de instalação', 'text'],
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function date(value: unknown): string | null {
  if (value === null) return 'Não informado'
  if (typeof value !== 'string') return null
  try { return formatDateTime(value) } catch { return null }
}
function formatValue(value: unknown, kind: Kind): string | null {
  if (value === null) return 'Não informado'
  if (kind === 'discount') return typeof value === 'string' && Object.hasOwn(discountTypeLabels, value) ? discountTypeLabels[value as keyof typeof discountTypeLabels] : null
  if (kind === 'text') return typeof value === 'string' ? value : null
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (kind === 'money') return Number.isSafeInteger(value) ? formatMoney(value) : null
  if (kind === 'integer') return Number.isSafeInteger(value) ? String(value) : null
  return kind === 'measure' ? formatMeasure(value) : formatQuantity(value)
}
export function historyDetailLines(entry: QuoteHistoryEntry): string[] {
  const details = entry.details
  if (!record(details)) return []
  if (entry.eventType === 'QUOTE_EDITED') {
    if (!Array.isArray(details.changes)) return []
    return details.changes.flatMap((change: unknown) => {
      if (!record(change) || typeof change.field !== 'string' || !Object.hasOwn(fields, change.field)) return []
      const [label, kind] = fields[change.field]
      const previous = formatValue(change.previous, kind); const next = formatValue(change.next, kind)
      if (previous === null || next === null) return []
      const locator: string[] = []
      if (typeof change.curtainSequence === 'number' && Number.isSafeInteger(change.curtainSequence)) locator.push(`Cortina ${change.curtainSequence}`)
      if (typeof change.curtainRoom === 'string' && change.curtainRoom) locator.push(change.curtainRoom)
      if (typeof change.componentName === 'string' && change.componentName) locator.push(`Componente ${change.componentName}`)
      return [`${locator.length ? `${locator.join(' · ')} — ` : ''}${label}: ${previous} → ${next}`]
    })
  }
  const lines: string[] = []
  const addDate = (key: string, label: string) => { const value = date(details[key]); if (value !== null) lines.push(`${label}: ${value}`) }
  switch (entry.eventType) {
    case 'QUOTE_CREATED': if (typeof details.quoteNumber === 'string') lines.push(`Número: ${details.quoteNumber}`); break
    case 'QUOTE_SENT': addDate('validUntil', 'Validade'); if (details.firstSend === true) lines.push('Primeiro envio'); break
    case 'QUOTE_REOPENED': addDate('previousConfirmedAt', 'Confirmação anterior'); addDate('previousScheduledInstallationAt', 'Instalação anterior'); break
    case 'QUOTE_RENEWED': addDate('previousValidUntil', 'Validade anterior'); addDate('newValidUntil', 'Nova validade'); break
    case 'QUOTE_CANCELLED': if (typeof details.reason === 'string') lines.push(`Motivo: ${details.reason}`); break
    case 'INSTALLATION_SCHEDULED': addDate('scheduledInstallationAt', 'Instalação agendada'); break
    case 'INSTALLATION_CHANGED': addDate('previousScheduledInstallationAt', 'Instalação anterior'); addDate('scheduledInstallationAt', 'Nova instalação'); break
    case 'INSTALLATION_REMOVED': addDate('previousScheduledInstallationAt', 'Instalação removida'); break
  }
  return lines
}
