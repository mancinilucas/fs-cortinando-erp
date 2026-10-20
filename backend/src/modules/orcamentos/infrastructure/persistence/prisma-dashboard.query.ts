import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import type {
  DashboardStatusCounts,
  InstallationListItem,
} from '../../application/queries/dashboard-read-model.js';
import { DashboardQueryRepository } from '../../application/ports/dashboard-query.repository.js';
import type { QuoteStatus } from '../../domain/entities/quote.js';
import {
  expiredQuoteCondition,
  validSentQuoteCondition,
} from './quote-expiration-sql.js';

// D107: only these statuses can have a late installation. The same set defines
// upcoming and weekly installations. The quote table must be aliased as `q`.
const INSTALLATION_STATUSES = Prisma.sql`q.status::text IN ('CONFIRMED', 'IN_PRODUCTION')`;

interface StatusCountsRow {
  draft: number;
  sent: number;
  expired: number;
  confirmed: number;
  inProduction: number;
}

interface InstallationRow {
  quoteId: string;
  quoteNumber: string;
  customerName: string;
  scheduledInstallationAt: Date;
  status: QuoteStatus;
}

@Injectable()
export class PrismaDashboardQuery extends DashboardQueryRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async getStatusCounts(now: Date): Promise<DashboardStatusCounts> {
    const [row] = await this.prisma.$queryRaw<StatusCountsRow[]>(Prisma.sql`
      SELECT
        (COUNT(*) FILTER (WHERE q.status::text = 'DRAFT'))::int AS "draft",
        (COUNT(*) FILTER (WHERE ${validSentQuoteCondition(now)}))::int AS "sent",
        (COUNT(*) FILTER (WHERE ${expiredQuoteCondition(now)}))::int AS "expired",
        (COUNT(*) FILTER (WHERE q.status::text = 'CONFIRMED'))::int AS "confirmed",
        (COUNT(*) FILTER (WHERE q.status::text = 'IN_PRODUCTION'))::int AS "inProduction"
      FROM quotes q
      WHERE q.status::text IN ('DRAFT', 'SENT', 'CONFIRMED', 'IN_PRODUCTION')
    `);

    if (row === undefined) {
      throw new Error('Dashboard status counts query returned no row');
    }

    return {
      draft: row.draft,
      sent: row.sent,
      expired: row.expired,
      confirmed: row.confirmed,
      inProduction: row.inProduction,
    };
  }

  async listUpcomingInstallations(
    now: Date,
    limit: number,
  ): Promise<InstallationListItem[]> {
    return this.listInstallations(
      Prisma.sql`
        q.scheduled_installation_at >= ${now}
        AND ${INSTALLATION_STATUSES}
      `,
      limit,
    );
  }

  async listWeeklyInstallations(
    start: Date,
    end: Date,
  ): Promise<InstallationListItem[]> {
    return this.listInstallations(Prisma.sql`
      q.scheduled_installation_at >= ${start}
      AND q.scheduled_installation_at < ${end}
      AND ${INSTALLATION_STATUSES}
    `);
  }

  async listOverdueInstallations(now: Date): Promise<InstallationListItem[]> {
    return this.listInstallations(Prisma.sql`
      q.scheduled_installation_at IS NOT NULL
      AND q.scheduled_installation_at < ${now}
      AND ${INSTALLATION_STATUSES}
    `);
  }

  private async listInstallations(
    where: Prisma.Sql,
    limit?: number,
  ): Promise<InstallationListItem[]> {
    const limitClause =
      limit === undefined ? Prisma.empty : Prisma.sql`LIMIT ${limit}`;

    // D236: soft-deleted customers remain visible; the join never filters
    // deleted_at. The projection is intentionally narrow (D233/D235).
    const rows = await this.prisma.$queryRaw<InstallationRow[]>(Prisma.sql`
      SELECT
        q.id AS "quoteId",
        q.quote_number AS "quoteNumber",
        c.name AS "customerName",
        q.scheduled_installation_at AS "scheduledInstallationAt",
        q.status::text AS "status"
      FROM quotes q
      JOIN customers c ON c.id = q.customer_id
      WHERE ${where}
      ORDER BY q.scheduled_installation_at ASC, q.quote_number ASC
      ${limitClause}
    `);

    return rows.map((row) => ({
      quoteId: row.quoteId,
      quoteNumber: row.quoteNumber,
      customerName: row.customerName,
      scheduledInstallationAt: row.scheduledInstallationAt,
      status: row.status,
    }));
  }
}
