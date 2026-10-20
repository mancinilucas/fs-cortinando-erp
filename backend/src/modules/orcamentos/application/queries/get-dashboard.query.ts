import { Injectable } from '@nestjs/common';
import { DashboardQueryRepository } from '../ports/dashboard-query.repository.js';
import { Clock } from '../ports/clock.port.js';
import type { DashboardView } from './dashboard-read-model.js';
import { calculateDashboardWeek } from './dashboard-week-boundaries.js';

// D223: the dashboard shows at most five upcoming installations.
const UPCOMING_INSTALLATIONS_LIMIT = 5;

/**
 * Composes the dashboard read model (D240). Reads are independent projections
 * and never load aggregates or mutate state.
 */
@Injectable()
export class GetDashboardQuery {
  constructor(
    private readonly dashboard: DashboardQueryRepository,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<DashboardView> {
    const now = this.clock.now();
    const week = calculateDashboardWeek(now);

    const statusCounts = await this.dashboard.getStatusCounts(now);
    const upcomingInstallations =
      await this.dashboard.listUpcomingInstallations(
        now,
        UPCOMING_INSTALLATIONS_LIMIT,
      );
    const weeklyInstallations = await this.dashboard.listWeeklyInstallations(
      week.start,
      week.end,
    );
    const overdueInstallations =
      await this.dashboard.listOverdueInstallations(now);

    return {
      statusCounts,
      upcomingInstallations,
      weeklyInstallations,
      overdueInstallations,
    };
  }
}
