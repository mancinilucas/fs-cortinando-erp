import type { QuoteStatus } from '../../domain/entities/quote.js';

// Public dashboard response (D237/D239). Counters are integers, dates are
// ISO 8601 strings and no Customer contact or financial data is exposed.

export class DashboardStatusCountsResponseDto {
  draft: number;
  sent: number;
  expired: number;
  confirmed: number;
  inProduction: number;
}

export class DashboardInstallationResponseDto {
  quoteId: string;
  quoteNumber: string;
  customerName: string;
  scheduledInstallationAt: string;
  status: QuoteStatus;
}

export class DashboardResponseDto {
  statusCounts: DashboardStatusCountsResponseDto;
  upcomingInstallations: DashboardInstallationResponseDto[];
  weeklyInstallations: DashboardInstallationResponseDto[];
  overdueInstallations: DashboardInstallationResponseDto[];
}
