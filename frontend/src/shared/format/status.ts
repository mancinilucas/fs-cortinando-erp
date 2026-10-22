import type { QuoteDisplayStatus } from './labels'

export const quoteStatusMetadata = {
  DRAFT: { className: 'bg-surface-alt text-text-secondary border-border-default', icon: 'pencil' },
  SENT: { className: 'bg-brand-navy-tint text-brand-navy border-[#C9D3E2]', icon: 'send' },
  EXPIRED: { className: 'bg-warning-bg text-warning-fg border-warning-border', icon: 'clock-alert' },
  CONFIRMED: { className: 'bg-success-bg text-success-fg border-success-border', icon: 'check' },
  IN_PRODUCTION: { className: 'bg-brand-orange-tint text-[#8A4A12] border-[#EBC9AF]', icon: 'settings' },
  COMPLETED: { className: 'bg-success-bg text-success-fg border-success-border', icon: 'check-check' },
  CANCELLED: { className: 'bg-surface-alt text-[#6F6C68] border-border-default', icon: 'minus' },
} as const satisfies Record<QuoteDisplayStatus, { className: string; icon: string }>
