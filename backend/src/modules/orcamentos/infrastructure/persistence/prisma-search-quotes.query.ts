import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import type { QuoteStatus } from '../../domain/entities/quote.js';
import {
  QuoteSearchQueryRepository,
  type QuoteSearchFilter,
  type QuoteSummaryView,
} from '../../application/ports/quote-search-query.repository.js';
import {
  expiredQuoteCondition,
  validSentQuoteCondition,
} from './quote-expiration-sql.js';

interface QuoteSummaryRow {
  id: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  status: QuoteStatus;
  expired: boolean;
  totalCents: bigint;
  createdAt: Date;
  validUntil: Date | null;
  scheduledInstallationAt: Date | null;
}

@Injectable()
export class PrismaSearchQuotesQuery extends QuoteSearchQueryRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async search(
    filter: QuoteSearchFilter,
    now: Date,
  ): Promise<QuoteSummaryView[]> {
    const conditions: Prisma.Sql[] = [];

    if (filter.search !== undefined) {
      const pattern = `%${escapeLikePattern(filter.search)}%`;

      conditions.push(
        Prisma.sql`(c.name ILIKE ${pattern} OR q.quote_number ILIKE ${pattern})`,
      );
    }

    // D106: EXPIRED is virtual; SENT excludes the expired SENT rows.
    if (filter.status === 'EXPIRED') {
      conditions.push(expiredQuoteCondition(now));
    } else if (filter.status === 'SENT') {
      conditions.push(validSentQuoteCondition(now));
    } else if (filter.status !== undefined) {
      conditions.push(Prisma.sql`q.status::text = ${filter.status}`);
    }

    return this.run(conditions, now);
  }

  async listByCustomerId(
    customerId: string,
    now: Date,
  ): Promise<QuoteSummaryView[] | null> {
    // Soft-deleted customers still satisfy this lookup: their quotes remain
    // available as history. Only a missing row yields null.
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (customer === null) {
      return null;
    }

    return this.run([Prisma.sql`q.customer_id = ${customerId}`], now);
  }

  private async run(
    conditions: Prisma.Sql[],
    now: Date,
  ): Promise<QuoteSummaryView[]> {
    const where =
      conditions.length === 0
        ? Prisma.empty
        : Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

    // D93: totals are never persisted. Each item is rounded before the sum
    // (Postgres numeric ROUND is HALF_UP, matching the domain), and the discount
    // follows D91 and the adjustment D92.
    const rows = await this.prisma.$queryRaw<QuoteSummaryRow[]>(Prisma.sql`
      WITH curtain_totals AS (
        SELECT cu.quote_id,
               SUM(COALESCE(ROUND(fc.quantity * fc.unit_price_cents), 0)) AS total
        FROM curtains cu
        JOIN financial_components fc ON fc.curtain_id = cu.id
        GROUP BY cu.quote_id
      ),
      add_on_totals AS (
        SELECT ga.quote_id,
               SUM(COALESCE(ROUND(ga.quantity * ga.unit_price_cents), 0)) AS total
        FROM general_add_ons ga
        GROUP BY ga.quote_id
      ),
      quote_totals AS (
        SELECT q.id,
               COALESCE(ct.total, 0) + COALESCE(at.total, 0) AS subtotal
        FROM quotes q
        LEFT JOIN curtain_totals ct ON ct.quote_id = q.id
        LEFT JOIN add_on_totals at ON at.quote_id = q.id
      )
      SELECT
        q.id,
        q.quote_number AS "quoteNumber",
        q.customer_id AS "customerId",
        c.name AS "customerName",
        q.status::text AS "status",
        ${expiredQuoteCondition(now)} AS "expired",
        (
          qt.subtotal
          - CASE q.discount_type::text
              WHEN 'PERCENTAGE' THEN ROUND(qt.subtotal * q.discount_percentage / 100)
              WHEN 'FIXED_AMOUNT' THEN q.discount_fixed_amount_cents
              ELSE 0
            END
          + COALESCE(q.commercial_adjustment_cents, 0)
        )::bigint AS "totalCents",
        q.created_at AS "createdAt",
        q.valid_until AS "validUntil",
        q.scheduled_installation_at AS "scheduledInstallationAt"
      FROM quotes q
      JOIN customers c ON c.id = q.customer_id
      JOIN quote_totals qt ON qt.id = q.id
      ${where}
      ORDER BY q.created_at DESC, q.id DESC
    `);

    return rows.map((row) => ({
      id: row.id,
      quoteNumber: row.quoteNumber,
      customer: { id: row.customerId, name: row.customerName },
      status: row.status,
      expired: row.expired,
      totalCents: Number(row.totalCents),
      createdAt: row.createdAt,
      validUntil: row.validUntil,
      scheduledInstallationAt: row.scheduledInstallationAt,
    }));
  }
}

// A literal substring search: `\`, `%` and `_` are escaped because ILIKE
// treats them as pattern syntax (D58).
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
