export const quoteStatusLabels = {
  DRAFT: 'Rascunho',
  SENT: 'Enviado',
  EXPIRED: 'Expirado',
  CONFIRMED: 'Confirmado',
  IN_PRODUCTION: 'Em produção',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
} as const

export type QuoteDisplayStatus = keyof typeof quoteStatusLabels
export type QuoteStatus = Exclude<QuoteDisplayStatus, 'EXPIRED'>

export const discountTypeLabels = {
  NO_DISCOUNT: 'Sem desconto',
  PERCENTAGE: 'Percentual',
  FIXED_AMOUNT: 'Valor fixo',
} as const

export const historyEventLabels = {
  QUOTE_CREATED: 'Orçamento criado',
  QUOTE_SENT: 'Orçamento enviado',
  QUOTE_EDITED: 'Orçamento editado',
  QUOTE_CONFIRMED: 'Orçamento confirmado',
  QUOTE_REOPENED: 'Orçamento reaberto',
  QUOTE_RENEWED: 'Orçamento renovado',
  QUOTE_CANCELLED: 'Orçamento cancelado',
  PRODUCTION_STARTED: 'Produção iniciada',
  INSTALLATION_SCHEDULED: 'Instalação agendada',
  INSTALLATION_CHANGED: 'Instalação alterada',
  INSTALLATION_REMOVED: 'Instalação removida',
  SERVICE_COMPLETED: 'Serviço concluído',
  COMMERCIAL_PDF_GENERATED: 'PDF comercial gerado',
  PRODUCTION_ORDER_GENERATED: 'Ordem de produção gerada',
} as const

export const quoteActionLabels = {
  save: 'Salvar rascunho', delete: 'Excluir rascunho', send: 'Marcar como enviado',
  confirm: 'Confirmar', reopen: 'Reabrir orçamento', renew: 'Renovar orçamento',
  cancel: 'Cancelar orçamento', startProduction: 'Iniciar produção',
  complete: 'Concluir serviço', scheduleInstallation: 'Agendar instalação',
  removeInstallation: 'Remover instalação', previewPdf: 'Prévia do PDF',
  generatePdf: 'Gerar PDF', productionOrder: 'Ordem de produção',
} as const

export function getLabel(labels: Readonly<Record<string, string>>, code: string, fallback: string): string {
  return Object.hasOwn(labels, code) ? labels[code] : fallback
}
