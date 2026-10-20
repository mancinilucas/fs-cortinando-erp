import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { PrismaQuoteHistoryWriter } from './prisma-quote-history-writer.js';

describe('PrismaQuoteHistoryWriter integration', () => {
  // Reserved year band; parallel integration specs use disjoint ranges.
  const year = randomInt(3_200, 3_299);
  const customerId = randomUUID();
  let prisma: PrismaService;
  let writer: PrismaQuoteHistoryWriter;
  let quoteSequence = 0;

  async function seedQuote(): Promise<string> {
    const id = randomUUID();
    quoteSequence += 1;

    await prisma.quote.create({
      data: {
        id,
        quoteNumber: `ORÇ-${year}-${String(quoteSequence).padStart(3, '0')}`,
        customerId,
        status: 'CONFIRMED',
        notes: 'SENTINELA-NOTA',
        curtains: {
          create: [
            {
              sequence: 1,
              room: 'Sala',
              material: 'Linho',
              openingWidth: '2.600',
              borderValue: '0.150',
              height: '2.650',
              fabricFactor: '3.500',
              components: {
                create: [
                  {
                    name: 'SENTINELA-COMPONENTE',
                    quantity: '1.000000',
                    unit: 'un',
                    unitPriceCents: 1_000,
                  },
                ],
              },
            },
          ],
        },
        generalAddOns: {
          create: [
            {
              name: 'SENTINELA-ADICIONAL',
              quantity: '2.000000',
              unit: 'un',
              unitPriceCents: 500,
            },
          ],
        },
      },
    });

    return id;
  }

  async function snapshot(quoteId: string) {
    return {
      quote: await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } }),
      curtains: await prisma.curtain.findMany({
        where: { quoteId },
        orderBy: { sequence: 'asc' },
        include: { components: { orderBy: { name: 'asc' } } },
      }),
      generalAddOns: await prisma.generalAddOn.findMany({
        where: { quoteId },
        orderBy: { name: 'asc' },
      }),
    };
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    writer = new PrismaQuoteHistoryWriter(prisma);

    await prisma.customer.create({
      data: {
        id: customerId,
        name: `History Writer ${randomUUID()}`,
        phone: '11999999999',
      },
    });
  });

  afterAll(async () => {
    await prisma.quote.deleteMany({ where: { customerId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.$disconnect();
  });

  it('inserts a commercial PDF event with the given occurrence time', async () => {
    const quoteId = await seedQuote();
    const occurredAt = new Date('2026-10-20T12:34:56.789Z');

    await writer.append({
      quoteId,
      event: { type: 'COMMERCIAL_PDF_GENERATED' },
      occurredAt,
    });

    const rows = await prisma.quoteHistory.findMany({ where: { quoteId } });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      quoteId,
      eventType: 'COMMERCIAL_PDF_GENERATED',
      occurredAt,
      details: null,
    });
  });

  it('inserts a production order event without details', async () => {
    const quoteId = await seedQuote();
    const occurredAt = new Date('2026-10-20T13:00:00.000Z');

    await writer.append({
      quoteId,
      event: { type: 'PRODUCTION_ORDER_GENERATED' },
      occurredAt,
    });

    const rows = await prisma.quoteHistory.findMany({ where: { quoteId } });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      eventType: 'PRODUCTION_ORDER_GENERATED',
      occurredAt,
      details: null,
    });
  });

  it('leaves the quote and its children unchanged', async () => {
    const quoteId = await seedQuote();
    const before = await snapshot(quoteId);

    await writer.append({
      quoteId,
      event: { type: 'COMMERCIAL_PDF_GENERATED' },
      occurredAt: new Date('2026-10-20T14:00:00.000Z'),
    });

    expect(await snapshot(quoteId)).toEqual(before);
  });

  it('allows repeated events for the same quote', async () => {
    const quoteId = await seedQuote();
    const firstAt = new Date('2026-10-20T15:00:00.000Z');
    const secondAt = new Date('2026-10-20T15:05:00.000Z');

    await writer.append({
      quoteId,
      event: { type: 'COMMERCIAL_PDF_GENERATED' },
      occurredAt: firstAt,
    });
    await writer.append({
      quoteId,
      event: { type: 'COMMERCIAL_PDF_GENERATED' },
      occurredAt: secondAt,
    });

    const rows = await prisma.quoteHistory.findMany({
      where: { quoteId },
      orderBy: { occurredAt: 'asc' },
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.occurredAt)).toEqual([firstAt, secondAt]);
    expect(rows.every((row) => row.details === null)).toBe(true);
  });
});
