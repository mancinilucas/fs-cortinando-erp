import { describe, expect, it, vi } from 'vitest';
import { QuoteStatus } from '../../domain/entities/quote.js';
import { DashboardQueryRepository } from '../ports/dashboard-query.repository.js';
import type { InstallationListItem } from './dashboard-read-model.js';
import { GetDashboardQuery } from './get-dashboard.query.js';

const NOW = new Date('2026-10-19T12:00:00.000Z');
const WEEK_START = new Date('2026-10-19T03:00:00.000Z');
const WEEK_END = new Date('2026-10-26T03:00:00.000Z');

class FakeDashboardQueryRepository extends DashboardQueryRepository {
  readonly getStatusCounts =
    vi.fn<DashboardQueryRepository['getStatusCounts']>();
  readonly listUpcomingInstallations =
    vi.fn<DashboardQueryRepository['listUpcomingInstallations']>();
  readonly listWeeklyInstallations =
    vi.fn<DashboardQueryRepository['listWeeklyInstallations']>();
  readonly listOverdueInstallations =
    vi.fn<DashboardQueryRepository['listOverdueInstallations']>();
}

function installation(
  overrides: Partial<InstallationListItem> = {},
): InstallationListItem {
  return {
    quoteId: '11111111-1111-4111-8111-111111111111',
    quoteNumber: 'ORÇ-2026-001',
    customerName: 'Cliente',
    scheduledInstallationAt: new Date('2026-10-20T15:00:00.000Z'),
    status: QuoteStatus.CONFIRMED,
    ...overrides,
  };
}

function createQuery() {
  const repository = new FakeDashboardQueryRepository();
  const nowMock = vi.fn(() => new Date(NOW));
  const query = new GetDashboardQuery(repository, { now: nowMock });

  return { query, repository, nowMock };
}

describe('GetDashboardQuery', () => {
  it('composes the dashboard with the clock week and limit 5', async () => {
    const { query, repository, nowMock } = createQuery();
    const statusCounts = {
      draft: 1,
      sent: 2,
      expired: 3,
      confirmed: 4,
      inProduction: 5,
    };
    const upcoming = [installation()];
    const weekly = [installation({ quoteId: 'weekly' })];
    const overdue = [
      installation({
        quoteId: 'overdue',
        status: QuoteStatus.IN_PRODUCTION,
      }),
    ];

    repository.getStatusCounts.mockResolvedValue(statusCounts);
    repository.listUpcomingInstallations.mockResolvedValue(upcoming);
    repository.listWeeklyInstallations.mockResolvedValue(weekly);
    repository.listOverdueInstallations.mockResolvedValue(overdue);

    const result = await query.execute();

    expect(result).toEqual({
      statusCounts,
      upcomingInstallations: upcoming,
      weeklyInstallations: weekly,
      overdueInstallations: overdue,
    });
    expect(nowMock).toHaveBeenCalledTimes(1);
    expect(repository.getStatusCounts).toHaveBeenCalledWith(NOW);
    expect(repository.listUpcomingInstallations).toHaveBeenCalledWith(NOW, 5);
    expect(repository.listWeeklyInstallations).toHaveBeenCalledWith(
      WEEK_START,
      WEEK_END,
    );
    expect(repository.listOverdueInstallations).toHaveBeenCalledWith(NOW);
  });

  it('preserves empty arrays', async () => {
    const { query, repository } = createQuery();

    repository.getStatusCounts.mockResolvedValue({
      draft: 0,
      sent: 0,
      expired: 0,
      confirmed: 0,
      inProduction: 0,
    });
    repository.listUpcomingInstallations.mockResolvedValue([]);
    repository.listWeeklyInstallations.mockResolvedValue([]);
    repository.listOverdueInstallations.mockResolvedValue([]);

    await expect(query.execute()).resolves.toEqual({
      statusCounts: {
        draft: 0,
        sent: 0,
        expired: 0,
        confirmed: 0,
        inProduction: 0,
      },
      upcomingInstallations: [],
      weeklyInstallations: [],
      overdueInstallations: [],
    });
  });

  it('propagates an unexpected technical error', async () => {
    const { query, repository } = createQuery();
    const error = new Error('database unavailable');

    repository.getStatusCounts.mockRejectedValue(error);

    await expect(query.execute()).rejects.toBe(error);
  });
});
