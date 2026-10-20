import type {
  DashboardStatusCounts,
  InstallationListItem,
} from '../queries/dashboard-read-model.js';

// Dashboard read port (D240/D244). Each method is a narrow projection; the
// Prisma implementation lives in Infrastructure and may issue one or more
// queries. EXPIRED and lateInstallation remain derived (D106/D107).

export abstract class DashboardQueryRepository {
  abstract getStatusCounts(now: Date): Promise<DashboardStatusCounts>;

  abstract listUpcomingInstallations(
    now: Date,
    limit: number,
  ): Promise<InstallationListItem[]>;

  abstract listWeeklyInstallations(
    start: Date,
    end: Date,
  ): Promise<InstallationListItem[]>;

  abstract listOverdueInstallations(now: Date): Promise<InstallationListItem[]>;
}
