import type { QuoteStatus } from '../../domain/entities/quote.js';

// Dashboard read models (D232). They expose only Application data, keep dates
// as Date for Presentation serialization, and never include Customer contact
// or financial data (D233-D235).

export interface DashboardStatusCounts {
  draft: number;
  sent: number;
  expired: number;
  confirmed: number;
  inProduction: number;
}

export interface InstallationListItem {
  quoteId: string;
  quoteNumber: string;
  customerName: string;
  scheduledInstallationAt: Date;
  status: QuoteStatus;
}

export interface DashboardView {
  statusCounts: DashboardStatusCounts;
  upcomingInstallations: InstallationListItem[];
  weeklyInstallations: InstallationListItem[];
  overdueInstallations: InstallationListItem[];
}
