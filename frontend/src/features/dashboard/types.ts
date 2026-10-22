import type { QuoteStatus } from '@/shared/format/labels'

export type DashboardStatusCounts = {
  draft: number
  sent: number
  expired: number
  confirmed: number
  inProduction: number
}

export type DashboardInstallation = {
  quoteId: string
  quoteNumber: string
  customerName: string
  scheduledInstallationAt: string
  status: QuoteStatus
}

export type Dashboard = {
  statusCounts: DashboardStatusCounts
  upcomingInstallations: DashboardInstallation[]
  weeklyInstallations: DashboardInstallation[]
  overdueInstallations: DashboardInstallation[]
}
