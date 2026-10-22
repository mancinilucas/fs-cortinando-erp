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
export { localDateTimeToIso as validityToIso } from './local-date-time'
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
