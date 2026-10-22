import type { Dashboard, DashboardInstallation } from './types'

const installation: DashboardInstallation = {
  quoteId: 'quote-2', quoteNumber: 'ORC-2026-002', customerName: 'Cliente de teste',
  scheduledInstallationAt: '2020-01-02T15:00:00.000Z', status: 'CONFIRMED',
}

// Deliberately unrelated counters, old dates and non-chronological list ordering.
export const dashboardFixture: Dashboard = {
  statusCounts: { draft: 17, sent: 23, expired: 11, confirmed: 9, inProduction: 4 },
  upcomingInstallations: [installation, { ...installation, quoteId: 'quote-1', scheduledInstallationAt: '2020-01-01T15:00:00.000Z' }],
  weeklyInstallations: [{ ...installation, status: 'IN_PRODUCTION' }],
  overdueInstallations: [{ ...installation, status: 'COMPLETED' }],
}
export const emptyDashboardFixture: Dashboard = {
  statusCounts: { draft: 0, sent: 0, expired: 0, confirmed: 0, inProduction: 0 },
  upcomingInstallations: [], weeklyInstallations: [], overdueInstallations: [],
}
