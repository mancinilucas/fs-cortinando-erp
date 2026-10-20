import { describe, expect, it } from 'vitest';
import { QuoteStatus } from '../domain/entities/quote.js';
import type { DashboardView } from '../application/queries/dashboard-read-model.js';
import { DashboardResponseMapper } from './dashboard-response.mapper.js';

const INSTALLATION = {
  quoteId: '11111111-1111-4111-8111-111111111111',
  quoteNumber: 'ORÇ-2026-001',
  customerName: 'Cliente',
  scheduledInstallationAt: new Date('2026-10-20T15:00:00.000Z'),
  status: QuoteStatus.CONFIRMED,
};

describe('DashboardResponseMapper', () => {
  it('maps the dashboard view to the closed public contract', () => {
    const view: DashboardView = {
      statusCounts: {
        draft: 1,
        sent: 2,
        expired: 3,
        confirmed: 4,
        inProduction: 5,
      },
      upcomingInstallations: [INSTALLATION],
      weeklyInstallations: [
        { ...INSTALLATION, status: QuoteStatus.IN_PRODUCTION },
      ],
      overdueInstallations: [
        {
          ...INSTALLATION,
          quoteId: '22222222-2222-4222-8222-222222222222',
        },
      ],
    };

    const response = DashboardResponseMapper.toResponse(view);

    expect(response).toEqual({
      statusCounts: {
        draft: 1,
        sent: 2,
        expired: 3,
        confirmed: 4,
        inProduction: 5,
      },
      upcomingInstallations: [
        {
          quoteId: INSTALLATION.quoteId,
          quoteNumber: 'ORÇ-2026-001',
          customerName: 'Cliente',
          scheduledInstallationAt: '2026-10-20T15:00:00.000Z',
          status: 'CONFIRMED',
        },
      ],
      weeklyInstallations: [
        {
          quoteId: INSTALLATION.quoteId,
          quoteNumber: 'ORÇ-2026-001',
          customerName: 'Cliente',
          scheduledInstallationAt: '2026-10-20T15:00:00.000Z',
          status: 'IN_PRODUCTION',
        },
      ],
      overdueInstallations: [
        {
          quoteId: '22222222-2222-4222-8222-222222222222',
          quoteNumber: 'ORÇ-2026-001',
          customerName: 'Cliente',
          scheduledInstallationAt: '2026-10-20T15:00:00.000Z',
          status: 'CONFIRMED',
        },
      ],
    });
    expect(Object.keys(response.statusCounts).sort()).toEqual([
      'confirmed',
      'draft',
      'expired',
      'inProduction',
      'sent',
    ]);
    expect(Object.keys(response.upcomingInstallations[0]).sort()).toEqual([
      'customerName',
      'quoteId',
      'quoteNumber',
      'scheduledInstallationAt',
      'status',
    ]);
  });
});
