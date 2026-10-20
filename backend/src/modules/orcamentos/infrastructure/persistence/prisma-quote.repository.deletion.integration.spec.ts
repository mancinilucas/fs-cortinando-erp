import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { PrismaQuoteRepository } from './prisma-quote.repository.js';
import { PrismaQuoteSequence } from './prisma-quote-sequence.js';

// Integration coverage for the repository-level draft deletion guard (D110).
// The use case already blocks non-DRAFT quotes through the aggregate; these
// tests exercise the SQL condition directly so a regression in the WHERE
// clause cannot silently delete a committed quote. Row counts are read from
// the database to confirm nothing is removed.

interface SeededQuote {
  quoteId: string;
  curtainId: string;
  componentId: string;
  addOnId: string;
  historyId: string;
}

describe('PrismaQuoteRepository integration — deletion guard', () => {
  const customerId = randomUUID();
  let prisma: PrismaService;
  let repository: PrismaQuoteRepository;

  async function seedSentQuote(): Promise<SeededQuote> {
    const seeded: SeededQuote = {
      quoteId: randomUUID(),
      curtainId: randomUUID(),
      componentId: randomUUID(),
      addOnId: randomUUID(),
      historyId: randomUUID(),
    };

    await prisma.quote.create({
      data: {
        id: seeded.quoteId,
        quoteNumber: `ORÇ-2399-${randomInt(100_000, 1_000_000_000)}`,
        customerId,
        status: 'SENT',
        curtains: {
          create: [
            {
              id: seeded.curtainId,
              sequence: 1,
              room: 'Sala',
              components: {
                create: [
                  {
                    id: seeded.componentId,
                    name: 'Tecido',
                    quantity: '2.000000',
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
              id: seeded.addOnId,
              name: 'Frete',
              quantity: '1.000000',
              unitPriceCents: 5_000,
            },
          ],
        },
        history: {
          create: [
            {
              id: seeded.historyId,
              eventType: 'QUOTE_SENT',
              details: {
                validUntil: '2026-11-01T12:00:00.000Z',
                firstSend: true,
              },
            },
          ],
        },
      },
    });

    return seeded;
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaQuoteRepository(
      prisma,
      new PrismaQuoteSequence(prisma),
    );

    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Deletion guard ${randomUUID()}`,
        phone: '11999999999',
      },
    });
  });

  afterAll(async () => {
    await prisma.quote.deleteMany({ where: { customerId } });
    await prisma.customer.delete({ where: { id: customerId } });
    await prisma.$disconnect();
  });

  it('returns false for a quote that does not exist', async () => {
    await expect(repository.deleteDraft(randomUUID())).resolves.toBe(false);
  });

  it('refuses a non-DRAFT quote and keeps every row', async () => {
    const seeded = await seedSentQuote();

    await expect(repository.deleteDraft(seeded.quoteId)).resolves.toBe(false);

    const [quotes, curtains, components, addOns, history] = await Promise.all([
      prisma.quote.count({ where: { id: seeded.quoteId } }),
      prisma.curtain.count({ where: { quoteId: seeded.quoteId } }),
      prisma.financialComponent.count({ where: { id: seeded.componentId } }),
      prisma.generalAddOn.count({ where: { quoteId: seeded.quoteId } }),
      prisma.quoteHistory.count({ where: { quoteId: seeded.quoteId } }),
    ]);

    expect([quotes, curtains, components, addOns, history]).toEqual([
      1, 1, 1, 1, 1,
    ]);
  });
});
