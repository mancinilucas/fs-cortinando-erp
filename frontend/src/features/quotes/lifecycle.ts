import { DISPLAY_TIME_ZONE } from '@/shared/format/dates'
import type { QuoteDetail } from './types'

export type LifecycleAction = 'send' | 'confirm' | 'reopen' | 'renew' | 'cancel' | 'startProduction' | 'complete' | 'delete'
export function lifecycleActions(quote: QuoteDetail): LifecycleAction[] {
  switch (quote.status) {
    case 'DRAFT': return ['send', 'cancel', 'delete']
    case 'SENT': return quote.expired ? ['renew', 'cancel'] : ['confirm', 'renew', 'cancel']
    case 'CONFIRMED': return ['reopen', 'cancel', 'startProduction']
    case 'IN_PRODUCTION': return ['complete']
    default: return []
  }
}
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: DISPLAY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
function localParts(instant: number) {
  const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}
export function validityToIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new RangeError('Informe data e hora válidas.')
  const calendar = Date.parse(`${value}:00Z`)
  if (!Number.isFinite(calendar) || new Date(calendar).toISOString().slice(0, 16) !== value) throw new RangeError('Informe data e hora válidas.')
  let instant = calendar
  for (let i = 0; i < 3; i++) instant += calendar - Date.parse(`${localParts(instant)}:00Z`)
  if (localParts(instant) !== value) throw new RangeError('Informe data e hora válidas.')
  return new Date(instant).toISOString()
}
export const lifecycleDescriptions: Record<LifecycleAction, string> = {
  send: 'Confirme o envio. Sem uma validade informada, o servidor aplica 30 dias.',
  confirm: 'Confirme a aprovação deste orçamento. A edição será bloqueada.',
  reopen: 'A reabertura remove a confirmação e o agendamento de instalação. A validade é mantida e o orçamento pode voltar expirado, exigindo renovação e nova confirmação.',
  renew: 'Informe uma nova validade futura. O número e o histórico do orçamento serão mantidos.',
  cancel: 'O cancelamento é definitivo. O orçamento será mantido para consulta e não poderá ser reaberto.',
  startProduction: 'Iniciar a produção é irreversível. Após esta ação, o orçamento não poderá ser cancelado.',
  complete: 'Confirme a conclusão do serviço. A ação é irreversível.',
  delete: 'Excluir o rascunho remove o orçamento e seus itens definitivamente. O número não será reutilizado.',
}
