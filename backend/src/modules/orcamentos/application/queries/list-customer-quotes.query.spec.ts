import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { formatQuoteNumber } from '../../domain/value-objects/quote-number.js';
import { PrismaSearchQuotesQuery } from '../../infrastructure/persistence/prisma-search-quotes.query.js';
import { QuoteCustomerNotFoundError } from '../errors/quote-customer-not-found.error.js';
import { ListCustomerQuotesQuery } from './list-customer-quotes.query.js';

describe('ListCustomerQuotesQuery integration', () => {
  // Reserved year band; parallel integration specs use disjoint ranges so
  // fixtures never share a quote number.
  const year = randomInt(1_100, 1_199);
  const now = new Date('2026-10-19T12:00:00.000Z');
  const activeCustomer = randomUUID();
  const otherCustomer = randomUUID();
  const deletedCustomer = randomUUID();
  const emptyCustomer = randomUUID();
  const customerIds = [
    activeCustomer,
    otherCustomer,
    deletedCustomer,
    emptyCustomer,
  ];
  let prisma: PrismaService;
  let query: ListCustomerQuotesQuery;
  let quoteCounter = 0;
  const ids = new Map<string, string>();

  function nextNumber(): string {
    quoteCounter += 1;

    return formatQuoteNumber(year, quoteCounter);
  }

  async function seedQuote(
    key: string,
    customerId: string,
    status: 'DRAFT' | 'SENT' | 'CONFIRMED',
    createdAt: Date,
  ): Promise<string> {
    const id = randomUUID();

    ids.set(key, id);

    await prisma.quote.create({
      data: {
        id,
        quoteNumber: nextNumber(),
        customerId,
        status,
        createdAt,
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
    query = new ListCustomerQuotesQuery(new PrismaSearchQuotesQuery(prisma), {
      now: () => new Date(now),
    });

    await prisma.customer.createMany({
      data: [
        { id: activeCustomer, name: 'Active Customer', phone: '11999999999' },
        { id: otherCustomer, name: 'Other Customer', phone: '11988888888' },
        { id: deletedCustomer, name: 'Deleted Customer', phone: '11977777777' },
        { id: emptyCustomer, name: 'Empty Customer', phone: '11966666666' },
      ],
    });

    await seedQuote(
      'activeOldest',
      activeCustomer,
      'DRAFT',
      new Date('2026-10-01T10:00:00.000Z'),
    );
    await seedQuote(
      'activeTieA',
      activeCustomer,
      'SENT',
      new Date('2026-10-02T10:00:00.000Z'),
    );
    await seedQuote(
      'activeTieB',
      activeCustomer,
      'CONFIRMED',
      new Date('2026-10-02T10:00:00.000Z'),
    );
    await seedQuote(
      'activeNewest',
      activeCustomer,
      'DRAFT',
      new Date('2026-10-03T10:00:00.000Z'),
    );
    await seedQuote(
      'foreign',
      otherCustomer,
      'DRAFT',
      new Date('2026-10-04T10:00:00.000Z'),
    );
    await seedQuote(
      'deletedOlder',
      deletedCustomer,
      'SENT',
      new Date('2026-10-05T10:00:00.000Z'),
    );
    await seedQuote(
      'deletedNewer',
      deletedCustomer,
      'CONFIRMED',
      new Date('2026-10-06T10:00:00.000Z'),
    );

    await prisma.customer.update({
      where: { id: deletedCustomer },
      data: { deletedAt: now },
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

  it('returns only the customer quotes, ordered by createdAt DESC, id DESC', async () => {
    const results = await query.execute(activeCustomer);

    // The two tied fixtures are ordered by id DESC, whichever that is.
    const tied = [idOf('activeTieA'), idOf('activeTieB')].sort().reverse();

    expect(results.map((item) => item.id)).toEqual([
      idOf('activeNewest'),
      ...tied,
      idOf('activeOldest'),
    ]);
    expectOrdered(results);
    expect(results.every((item) => item.customer.id === activeCustomer)).toBe(
      true,
    );
  });

  it('keeps the history of a soft-deleted customer', async () => {
    const deleted = await prisma.customer.findUnique({
      where: { id: deletedCustomer },
      select: { deletedAt: true },
    });

    expect(deleted?.deletedAt).toEqual(now);

    const results = await query.execute(deletedCustomer);

    expect(results.map((item) => item.id)).toEqual([
      idOf('deletedNewer'),
      idOf('deletedOlder'),
    ]);
    expectOrdered(results);
  });

  it('returns an empty list for an existing customer without quotes', async () => {
    await expect(query.execute(emptyCustomer)).resolves.toEqual([]);
  });

  it('reports an unknown customer as not found', async () => {
    await expect(query.execute(randomUUID())).rejects.toBeInstanceOf(
      QuoteCustomerNotFoundError,
    );
  });
});
