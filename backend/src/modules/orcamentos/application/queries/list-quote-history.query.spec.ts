import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { PrismaQuoteHistoryQueryRepository } from '../../infrastructure/persistence/prisma-quote-history-query.repository.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { ListQuoteHistoryQuery } from './list-quote-history.query.js';

describe('ListQuoteHistoryQuery integration', () => {
  // Reserved year band; parallel integration specs use disjoint ranges.
  const year = randomInt(1_300, 1_399);
  const customerId = randomUUID();
  let prisma: PrismaService;
  let query: ListQuoteHistoryQuery;

  async function seedQuote(): Promise<string> {
    const id = randomUUID();

    await prisma.quote.create({
      data: {
        id,
        quoteNumber: `ORÇ-${year}-001`,
        customerId,
        status: 'CONFIRMED',
      },
    });

    return id;
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    query = new ListQuoteHistoryQuery(
      new PrismaQuoteHistoryQueryRepository(prisma),
    );

    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Quote History ${randomUUID()}`,
        phone: '11999999999',
      },
    });
  });

  afterAll(async () => {
    await prisma.quote.deleteMany({ where: { customerId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.$disconnect();
  });

  it('rejects a quote that does not exist', async () => {
    await expect(query.execute({ id: randomUUID() })).rejects.toBeInstanceOf(
      QuoteNotFoundError,
    );
  });

  it('returns every event ordered by occurredAt ASC and id ASC', async () => {
    const quoteId = await seedQuote();
    const firstAt = new Date('2026-10-19T12:00:00.000Z');
    const secondAt = new Date('2026-10-19T13:00:00.000Z');
    const thirdAt = new Date('2026-10-19T14:00:00.000Z');

    const created = await prisma.quoteHistory.create({
      data: {
        quoteId,
        eventType: 'QUOTE_CREATED',
        occurredAt: firstAt,
        details: { quoteNumber: `ORÇ-${year}-001` },
      },
    });
    const edited = await prisma.quoteHistory.create({
      data: {
        quoteId,
        eventType: 'QUOTE_EDITED',
        occurredAt: secondAt,
        details: { changes: [] },
      },
    });
    const renewed = await prisma.quoteHistory.create({
      data: {
        quoteId,
        eventType: 'QUOTE_RENEWED',
        occurredAt: secondAt,
        details: {
          previousValidUntil: '2026-10-30T12:00:00.000Z',
          newValidUntil: '2026-11-30T12:00:00.000Z',
        },
      },
    });
    const confirmed = await prisma.quoteHistory.create({
      data: {
        quoteId,
        eventType: 'QUOTE_CONFIRMED',
        occurredAt: thirdAt,
        details: null,
      },
    });

    const expectedTieOrder =
      edited.id < renewed.id
        ? [edited.id, renewed.id]
        : [renewed.id, edited.id];

    const entries = await query.execute({ id: quoteId });
    const eventTypes = new Map([
      [created.id, 'QUOTE_CREATED'],
      [edited.id, 'QUOTE_EDITED'],
      [renewed.id, 'QUOTE_RENEWED'],
      [confirmed.id, 'QUOTE_CONFIRMED'],
    ]);

    expect(entries.map((entry) => entry.id)).toEqual([
      created.id,
      ...expectedTieOrder,
      confirmed.id,
    ]);
    expect(entries.map((entry) => entry.eventType)).toEqual(
      [created.id, ...expectedTieOrder, confirmed.id].map((id) =>
        eventTypes.get(id),
      ),
    );
    expect(entries.map((entry) => entry.occurredAt)).toEqual([
      firstAt,
      secondAt,
      secondAt,
      thirdAt,
    ]);
    expect(entries.find((entry) => entry.id === created.id)?.details).toEqual({
      quoteNumber: `ORÇ-${year}-001`,
    });
    expect(entries.find((entry) => entry.id === edited.id)?.details).toEqual({
      changes: [],
    });
    expect(
      entries.find((entry) => entry.id === confirmed.id)?.details,
    ).toBeNull();
  });
});
