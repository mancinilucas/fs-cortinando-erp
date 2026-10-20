import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { Prisma, QuoteStatus } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { formatQuoteNumber } from '../../domain/value-objects/quote-number.js';
import { PrismaDashboardQuery } from './prisma-dashboard.query.js';

describe('PrismaDashboardQuery integration', () => {
  // Reserved year band; parallel integration specs use disjoint ranges.
  const year = randomInt(3_300, 3_399);
  const token = randomUUID();
  const now = new Date('2040-01-10T12:00:00.000Z');
  const weekStart = new Date('2041-03-04T03:00:00.000Z');
  const weekEnd = new Date('2041-03-11T03:00:00.000Z');
  let prisma: PrismaService;
  let quoteCounter = 0;

  function nextQuoteNumber(): string {
    quoteCounter += 1;

    return formatQuoteNumber(year, quoteCounter);
  }

  interface SeedQuoteInput {
    customerId: string;
    status: QuoteStatus;
    validUntil?: Date | null;
    scheduledInstallationAt?: Date | null;
  }

  async function seedQuote(
    tx: Prisma.TransactionClient,
    input: SeedQuoteInput,
  ): Promise<{ id: string; quoteNumber: string }> {
    const id = randomUUID();
    const quoteNumber = nextQuoteNumber();

    await tx.quote.create({
      data: {
        id,
        quoteNumber,
        customerId: input.customerId,
        status: input.status,
        validUntil: input.validUntil ?? null,
        scheduledInstallationAt: input.scheduledInstallationAt ?? null,
      },
    });

    return { id, quoteNumber };
  }

  async function seedCustomer(
    tx: Prisma.TransactionClient,
    options: { deleted?: boolean } = {},
  ): Promise<{ id: string; name: string }> {
    const id = randomUUID();
    const name = `Dashboard ${token} ${randomUUID()}`;

    await tx.customer.create({
      data: {
        id,
        name,
        phone: '11999999999',
        deletedAt: options.deleted
          ? new Date('2026-01-01T00:00:00.000Z')
          : null,
      },
    });

    return { id, name };
  }

  // RepeatableRead gives every test a stable snapshot: fixtures created by
  // parallel suites before the first read stay in the baseline, later commits
  // stay invisible, and the sentinel throw rolls all test rows back.
  class Rollback extends Error {}

  function withDashboardTransaction<T>(
    action: (
      query: PrismaDashboardQuery,
      tx: Prisma.TransactionClient,
    ) => Promise<T>,
  ): Promise<T> {
    let result: { value: T } | undefined;

    return prisma
      .$transaction(
        async (tx) => {
          const query = new PrismaDashboardQuery(
            tx as unknown as PrismaService,
          );

          result = { value: await action(query, tx) };
          throw new Rollback();
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      )
      .catch((error: unknown) => {
        if (!(error instanceof Rollback)) {
          throw error;
        }
      })
      .then(() => {
        if (result === undefined) {
          throw new Error('Dashboard transaction produced no result');
        }

        return result.value;
      });
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('counts each dashboard status with virtual SENT and EXPIRED', async () => {
    await withDashboardTransaction(async (query, tx) => {
      const customer = await seedCustomer(tx);
      const before = await query.getStatusCounts(now);

      await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.DRAFT,
      });
      await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.SENT,
        validUntil: null,
      });
      await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.SENT,
        validUntil: new Date(now.getTime() + 1),
      });
      await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.SENT,
        validUntil: now,
      });
      await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.SENT,
        validUntil: new Date(now.getTime() - 1),
      });
      await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.CONFIRMED,
      });
      await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.IN_PRODUCTION,
      });
      await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.COMPLETED,
      });
      await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.CANCELLED,
      });

      const after = await query.getStatusCounts(now);

      expect(Object.keys(after).sort()).toEqual([
        'confirmed',
        'draft',
        'expired',
        'inProduction',
        'sent',
      ]);
      expect(after.draft - before.draft).toBe(1);
      expect(after.sent - before.sent).toBe(3);
      expect(after.expired - before.expired).toBe(1);
      expect(after.confirmed - before.confirmed).toBe(1);
      expect(after.inProduction - before.inProduction).toBe(1);
    });
  });

  it('lists upcoming installations with inclusive now, ordering and limit 5', async () => {
    await withDashboardTransaction(async (query, tx) => {
      const customer = await seedCustomer(tx);
      const deletedCustomer = await seedCustomer(tx, { deleted: true });

      const past = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.CONFIRMED,
        scheduledInstallationAt: new Date(now.getTime() - 1),
      });
      const atNow = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.CONFIRMED,
        scheduledInstallationAt: now,
      });
      const deleted = await seedQuote(tx, {
        customerId: deletedCustomer.id,
        status: QuoteStatus.IN_PRODUCTION,
        scheduledInstallationAt: new Date(now.getTime() + 60_000),
      });
      const completed = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.COMPLETED,
        scheduledInstallationAt: new Date(now.getTime() + 120_000),
      });
      const cancelled = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.CANCELLED,
        scheduledInstallationAt: new Date(now.getTime() + 120_000),
      });
      const one = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.CONFIRMED,
        scheduledInstallationAt: new Date(now.getTime() + 180_000),
      });
      const two = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.IN_PRODUCTION,
        scheduledInstallationAt: new Date(now.getTime() + 240_000),
      });
      const three = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.CONFIRMED,
        scheduledInstallationAt: new Date(now.getTime() + 300_000),
      });
      const four = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.CONFIRMED,
        scheduledInstallationAt: new Date(now.getTime() + 360_000),
      });
      const five = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.CONFIRMED,
        scheduledInstallationAt: new Date(now.getTime() + 420_000),
      });

      const result = await query.listUpcomingInstallations(now, 5);

      expect(result.map((item) => item.quoteId)).toEqual([
        atNow.id,
        deleted.id,
        one.id,
        two.id,
        three.id,
      ]);
      expect(Object.keys(result[0]).sort()).toEqual([
        'customerName',
        'quoteId',
        'quoteNumber',
        'scheduledInstallationAt',
        'status',
      ]);
      expect(result[1].customerName).toBe(deletedCustomer.name);

      const ids = result.map((item) => item.quoteId);

      expect(ids).not.toContain(past.id);
      expect(ids).not.toContain(completed.id);
      expect(ids).not.toContain(cancelled.id);
      expect(ids).not.toContain(four.id);
      expect(ids).not.toContain(five.id);
    });
  });

  it('lists the civil week with [start, end) boundaries and tie-break', async () => {
    await withDashboardTransaction(async (query, tx) => {
      const customer = await seedCustomer(tx);

      const before = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.CONFIRMED,
        scheduledInstallationAt: new Date(weekStart.getTime() - 1),
      });
      const atStart = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.IN_PRODUCTION,
        scheduledInstallationAt: weekStart,
      });
      const tieA = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.CONFIRMED,
        scheduledInstallationAt: new Date(weekStart.getTime() + 3_600_000),
      });
      const tieB = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.CONFIRMED,
        scheduledInstallationAt: new Date(weekStart.getTime() + 3_600_000),
      });
      const inside = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.CONFIRMED,
        scheduledInstallationAt: new Date(weekEnd.getTime() - 1),
      });
      const atEnd = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.CONFIRMED,
        scheduledInstallationAt: weekEnd,
      });
      const completed = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.COMPLETED,
        scheduledInstallationAt: new Date(weekStart.getTime() + 7_200_000),
      });
      const cancelled = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.CANCELLED,
        scheduledInstallationAt: new Date(weekStart.getTime() + 10_800_000),
      });

      const result = await query.listWeeklyInstallations(weekStart, weekEnd);

      expect(result.map((item) => item.quoteId)).toEqual([
        atStart.id,
        tieA.id,
        tieB.id,
        inside.id,
      ]);
      expect(result.map((item) => item.quoteNumber)).toEqual([
        atStart.quoteNumber,
        tieA.quoteNumber,
        tieB.quoteNumber,
        inside.quoteNumber,
      ]);

      const ids = result.map((item) => item.quoteId);

      expect(ids).not.toContain(before.id);
      expect(ids).not.toContain(atEnd.id);
      expect(ids).not.toContain(completed.id);
      expect(ids).not.toContain(cancelled.id);
    });
  });

  it('lists overdue installations using D107 semantics, oldest first', async () => {
    await withDashboardTransaction(async (query, tx) => {
      const customer = await seedCustomer(tx);

      const older = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.CONFIRMED,
        scheduledInstallationAt: new Date(now.getTime() - 7_200_000),
      });
      const newer = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.IN_PRODUCTION,
        scheduledInstallationAt: new Date(now.getTime() - 3_600_000),
      });
      const boundary = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.CONFIRMED,
        scheduledInstallationAt: now,
      });
      const completed = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.COMPLETED,
        scheduledInstallationAt: new Date(now.getTime() - 10_800_000),
      });
      const cancelled = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.CANCELLED,
        scheduledInstallationAt: new Date(now.getTime() - 10_800_000),
      });
      const noSchedule = await seedQuote(tx, {
        customerId: customer.id,
        status: QuoteStatus.CONFIRMED,
      });

      const result = await query.listOverdueInstallations(now);
      const ourIds = new Set([older.id, newer.id]);
      const ours = result.filter((item) => ourIds.has(item.quoteId));

      expect(ours.map((item) => item.quoteId)).toEqual([older.id, newer.id]);
      expect(result.every((item) => item.scheduledInstallationAt < now)).toBe(
        true,
      );
      expect(
        result.every(
          (item) =>
            item.status === QuoteStatus.CONFIRMED ||
            item.status === QuoteStatus.IN_PRODUCTION,
        ),
      ).toBe(true);

      const ids = result.map((item) => item.quoteId);

      expect(ids).not.toContain(boundary.id);
      expect(ids).not.toContain(completed.id);
      expect(ids).not.toContain(cancelled.id);
      expect(ids).not.toContain(noSchedule.id);
    });
  });

  it('returns empty lists when no installation matches', async () => {
    await withDashboardTransaction(async (query) => {
      await expect(
        query.listUpcomingInstallations(
          new Date('2100-01-01T00:00:00.000Z'),
          5,
        ),
      ).resolves.toEqual([]);
      await expect(
        query.listWeeklyInstallations(
          new Date('2099-01-01T00:00:00.000Z'),
          new Date('2099-01-08T00:00:00.000Z'),
        ),
      ).resolves.toEqual([]);
      await expect(
        query.listOverdueInstallations(new Date('1900-01-01T00:00:00.000Z')),
      ).resolves.toEqual([]);
    });
  });
});
