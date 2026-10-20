import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { formatQuoteNumber } from '../../domain/value-objects/quote-number.js';
import { PrismaQuoteRepository } from '../../infrastructure/persistence/prisma-quote.repository.js';
import { PrismaQuoteSequence } from '../../infrastructure/persistence/prisma-quote-sequence.js';
import { PrismaSearchQuotesQuery } from '../../infrastructure/persistence/prisma-search-quotes.query.js';
import type { QuoteSearchStatus } from '../ports/quote-search-query.repository.js';
import { SearchQuotesQuery } from './search-quotes.query.js';

type PersistedStatus =
  'DRAFT' | 'SENT' | 'CONFIRMED' | 'IN_PRODUCTION' | 'COMPLETED' | 'CANCELLED';

describe('SearchQuotesQuery integration', () => {
  // Reserved year band; parallel integration specs use disjoint ranges so
  // fixtures never share a quote number.
  const year = randomInt(1_000, 1_099);
  const token = randomUUID();
  const now = new Date('2026-10-19T12:00:00.000Z');
  const customerA = randomUUID();
  const customerB = randomUUID();
  const customerPercent = randomUUID();
  const customerIds = [customerA, customerB, customerPercent];
  let prisma: PrismaService;
  let repository: PrismaQuoteRepository;
  let query: SearchQuotesQuery;
  let quoteCounter = 0;
  const ids = new Map<string, string>();
  const numbers = new Map<string, string>();

  function nextNumber(): string {
    quoteCounter += 1;

    return formatQuoteNumber(year, quoteCounter);
  }

  interface SeedInput {
    key: string;
    customerId: string;
    status: PersistedStatus;
    createdAt: Date;
    validUntil?: Date | null;
    scheduledInstallationAt?: Date | null;
    discountType?: 'NO_DISCOUNT' | 'PERCENTAGE' | 'FIXED_AMOUNT';
    discountPercentage?: number | null;
    discountFixedAmountCents?: number | null;
    commercialAdjustmentCents?: number | null;
    components?: { name: string; quantity: number; unitPriceCents: number }[];
    addOnCents?: number;
  }

  async function seedQuote(input: SeedInput): Promise<string> {
    const id = randomUUID();
    const quoteNumber = nextNumber();

    ids.set(input.key, id);
    numbers.set(input.key, quoteNumber);

    await prisma.quote.create({
      data: {
        id,
        quoteNumber,
        customerId: input.customerId,
        status: input.status,
        createdAt: input.createdAt,
        validUntil: input.validUntil ?? null,
        scheduledInstallationAt: input.scheduledInstallationAt ?? null,
        discountType: input.discountType ?? 'NO_DISCOUNT',
        discountPercentage: input.discountPercentage ?? null,
        discountFixedAmountCents: input.discountFixedAmountCents ?? null,
        commercialAdjustmentCents: input.commercialAdjustmentCents ?? null,
        curtains:
          input.components === undefined
            ? undefined
            : {
                create: [
                  {
                    sequence: 1,
                    room: 'Sala',
                    components: { create: input.components },
                  },
                ],
              },
        generalAddOns:
          input.addOnCents === undefined
            ? undefined
            : {
                create: [
                  {
                    name: 'Instalação',
                    quantity: 1,
                    unitPriceCents: input.addOnCents,
                  },
                ],
              },
      },
    });

    return id;
  }

  function idOf(key: string): string {
    const id = ids.get(key);

    if (id === undefined) {
      throw new Error(`Unknown fixture ${key}`);
    }

    return id;
  }

  async function search(
    filter: { search?: string; status?: QuoteSearchStatus } = {},
  ) {
    return query.execute(filter);
  }

  function expectOrdered(results: { createdAt: Date; id: string }[]): void {
    for (let index = 0; index < results.length - 1; index += 1) {
      const current = results[index];
      const next = results[index + 1];

      expect(current.createdAt.getTime()).toBeGreaterThanOrEqual(
        next.createdAt.getTime(),
      );

      if (current.createdAt.getTime() === next.createdAt.getTime()) {
        expect(current.id > next.id).toBe(true);
      }
    }
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    repository = new PrismaQuoteRepository(
      prisma,
      new PrismaQuoteSequence(prisma),
    );
    query = new SearchQuotesQuery(new PrismaSearchQuotesQuery(prisma), {
      now: () => new Date(now),
    });

    await prisma.customer.createMany({
      data: [
        { id: customerA, name: `Alfa Cortinas ${token}`, phone: '11999999999' },
        { id: customerB, name: `Beta Decor ${token}`, phone: '11988888888' },
        {
          id: customerPercent,
          name: `Percent % ${token}`,
          phone: '11977777777',
        },
      ],
    });

    await seedQuote({
      key: 'rich',
      customerId: customerA,
      status: 'DRAFT',
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
      discountType: 'PERCENTAGE',
      discountPercentage: 10,
      commercialAdjustmentCents: -500,
      // The fractional quantities exercise D93 per-item HALF_UP: each one
      // rounds 33.3333 to 33 before the sum.
      components: [
        { name: 'Tecido', quantity: 8.05, unitPriceCents: 3_000 },
        { name: 'Argola', quantity: 10, unitPriceCents: 200 },
        { name: 'Franzido', quantity: 0.333333, unitPriceCents: 100 },
        { name: 'Bainha', quantity: 0.333333, unitPriceCents: 100 },
      ],
      addOnCents: 15_000,
    });
    await seedQuote({
      key: 'expired',
      customerId: customerA,
      status: 'SENT',
      createdAt: new Date('2026-10-02T10:00:00.000Z'),
      validUntil: new Date('2026-10-10T10:00:00.000Z'),
    });
    await seedQuote({
      key: 'validFuture',
      customerId: customerB,
      status: 'SENT',
      createdAt: new Date('2026-10-02T10:00:00.000Z'),
      validUntil: new Date('2026-10-30T10:00:00.000Z'),
    });
    await seedQuote({
      key: 'validNull',
      customerId: customerB,
      status: 'SENT',
      createdAt: new Date('2026-10-03T10:00:00.000Z'),
      validUntil: null,
    });
    await seedQuote({
      key: 'confirmed',
      customerId: customerA,
      status: 'CONFIRMED',
      createdAt: new Date('2026-10-04T10:00:00.000Z'),
      scheduledInstallationAt: new Date('2026-10-25T09:00:00.000Z'),
    });
    await seedQuote({
      key: 'inProduction',
      customerId: customerB,
      status: 'IN_PRODUCTION',
      createdAt: new Date('2026-10-05T10:00:00.000Z'),
    });
    await seedQuote({
      key: 'completed',
      customerId: customerA,
      status: 'COMPLETED',
      createdAt: new Date('2026-10-06T10:00:00.000Z'),
    });
    await seedQuote({
      key: 'cancelled',
      customerId: customerB,
      status: 'CANCELLED',
      createdAt: new Date('2026-10-07T10:00:00.000Z'),
    });
    await seedQuote({
      key: 'fixed',
      customerId: customerB,
      status: 'CONFIRMED',
      createdAt: new Date('2026-10-08T10:00:00.000Z'),
      discountType: 'FIXED_AMOUNT',
      discountFixedAmountCents: 2_025,
      commercialAdjustmentCents: 100,
      components: [{ name: 'Tecido', quantity: 1, unitPriceCents: 5_000 }],
    });
    await seedQuote({
      key: 'percent',
      customerId: customerPercent,
      status: 'DRAFT',
      createdAt: new Date('2026-10-09T10:00:00.000Z'),
    });
  });

  afterAll(async () => {
    await prisma.quote.deleteMany({
      where: { customerId: { in: customerIds } },
    });
    await prisma.customer.deleteMany({
      where: { id: { in: customerIds } },
    });
    await prisma.$disconnect();
  });

  it('returns the summary projection ordered by createdAt DESC, id DESC', async () => {
    const results = await search({ search: token });

    expect(new Set(results.map((item) => item.id))).toEqual(
      new Set(ids.values()),
    );
    expectOrdered(results);

    const confirmed = results.find((item) => item.id === idOf('confirmed'));

    expect(confirmed).toEqual({
      id: idOf('confirmed'),
      quoteNumber: numbers.get('confirmed'),
      customer: { id: customerA, name: `Alfa Cortinas ${token}` },
      status: 'CONFIRMED',
      expired: false,
      totalCents: 0,
      createdAt: new Date('2026-10-04T10:00:00.000Z'),
      validUntil: null,
      scheduledInstallationAt: new Date('2026-10-25T09:00:00.000Z'),
    });
    expect(
      results.find((item) => item.id === idOf('validFuture'))?.validUntil,
    ).toEqual(new Date('2026-10-30T10:00:00.000Z'));
  });

  it('treats a blank search as no search', async () => {
    const plain = await search({ search: token });
    const padded = await search({ search: `   ${token}   ` });

    expect(padded.map((item) => item.id)).toEqual(plain.map((item) => item.id));
  });

  it('searches partially by quote number, case-insensitively', async () => {
    const number = numbers.get('confirmed') ?? '';

    // Keep the fixture year in the partial term: sequence-only suffixes are
    // not unique against the other suites that share the database.
    const byPartial = await search({ search: number.slice(-8) });
    const byLowercase = await search({ search: number.toLowerCase() });

    expect(byPartial.map((item) => item.id)).toEqual([idOf('confirmed')]);
    expect(byLowercase.map((item) => item.id)).toEqual([idOf('confirmed')]);
  });

  it('searches by customer name, case-insensitively', async () => {
    const results = await search({ search: 'alfa cortinas' });

    expect(results.map((item) => item.id)).toEqual([
      idOf('completed'),
      idOf('confirmed'),
      idOf('expired'),
      idOf('rich'),
    ]);
  });

  it('treats LIKE wildcards as literal characters', async () => {
    const results = await search({ search: '%' });

    expect(results.map((item) => item.id)).toEqual([idOf('percent')]);
  });

  it.each([
    ['DRAFT', ['percent', 'rich']],
    ['SENT', ['validNull', 'validFuture']],
    ['CONFIRMED', ['fixed', 'confirmed']],
    ['IN_PRODUCTION', ['inProduction']],
    ['COMPLETED', ['completed']],
    ['CANCELLED', ['cancelled']],
  ] as const)('filters by %s', async (status, expectedKeys) => {
    const results = await search({ search: token, status });

    expect(results.map((item) => item.id)).toEqual(
      expectedKeys.map((key) => idOf(key)),
    );
    expect(results.every((item) => item.status === status)).toBe(true);
  });

  it('filters the virtual EXPIRED status', async () => {
    const results = await search({ search: token, status: 'EXPIRED' });

    expect(results.map((item) => item.id)).toEqual([idOf('expired')]);
    expect(results.every((item) => item.expired)).toBe(true);
    expect(results.every((item) => item.status === 'SENT')).toBe(true);
  });

  it('excludes expired quotes from the SENT filter', async () => {
    const results = await search({ search: token, status: 'SENT' });

    expect(results.map((item) => item.id)).toEqual([
      idOf('validNull'),
      idOf('validFuture'),
    ]);
    expect(results.every((item) => !item.expired)).toBe(true);
    expect(
      results.every(
        (item) => item.validUntil === null || item.validUntil >= now,
      ),
    ).toBe(true);
  });

  it('computes totalCents in SQL in parity with the domain', async () => {
    const results = await search({ search: token });
    const rich = results.find((item) => item.id === idOf('rich'));
    const fixed = results.find((item) => item.id === idOf('fixed'));
    const expired = results.find((item) => item.id === idOf('expired'));

    expect(rich?.totalCents).toBe(36_594);
    expect(fixed?.totalCents).toBe(3_075);
    expect(expired?.totalCents).toBe(0);

    const richDomain = await repository.findById(idOf('rich'));
    const fixedDomain = await repository.findById(idOf('fixed'));

    expect(rich?.totalCents).toBe(richDomain?.totalCents);
    expect(fixed?.totalCents).toBe(fixedDomain?.totalCents);
  });

  it('persists no fictional status', async () => {
    const persisted = await prisma.quote.groupBy({
      by: ['status'],
      where: { customerId: { in: customerIds } },
    });
    const allowed: PersistedStatus[] = [
      'DRAFT',
      'SENT',
      'CONFIRMED',
      'IN_PRODUCTION',
      'COMPLETED',
      'CANCELLED',
    ];

    expect(persisted.map((row) => row.status).sort()).toEqual(
      [...allowed].sort(),
    );
  });
});
