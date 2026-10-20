import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { QuoteStatus } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { PrismaQuoteSequence } from './prisma-quote-sequence.js';

// Exercises the annual counter against the real PostgreSQL database. Each run
// works in a reserved year band so it does not interfere with other specs.
describe('PrismaQuoteSequence integration', () => {
  const year = randomInt(3_100, 3_199);
  let prisma: PrismaService;
  let sequence: PrismaQuoteSequence;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    sequence = new PrismaQuoteSequence(prisma);

    await prisma.quoteSequence.deleteMany({
      where: { year: { in: [year, year + 1] } },
    });
  });

  afterAll(async () => {
    await prisma.quoteSequence.deleteMany({
      where: { year: { in: [year, year + 1] } },
    });
    await prisma.$disconnect();
  });

  it('reserves the first and second number of a year', async () => {
    expect(await sequence.reserveInTransaction(prisma, year)).toBe(1);
    expect(await sequence.reserveInTransaction(prisma, year)).toBe(2);
  });

  it('keeps years independent', async () => {
    expect(await sequence.reserveInTransaction(prisma, year + 1)).toBe(1);
    expect(await sequence.reserveInTransaction(prisma, year)).toBe(3);
  });

  it('grows naturally above three digits', async () => {
    await prisma.quoteSequence.upsert({
      where: { year },
      create: { year, lastNumber: 999 },
      update: { lastNumber: 999 },
    });

    expect(await sequence.reserveInTransaction(prisma, year)).toBe(1_000);
  });

  it('reserves concurrently without duplicates', async () => {
    await prisma.quoteSequence.upsert({
      where: { year },
      create: { year, lastNumber: 0 },
      update: { lastNumber: 0 },
    });

    const reserved = await Promise.all(
      Array.from({ length: 25 }, () =>
        sequence.reserveInTransaction(prisma, year),
      ),
    );

    expect([...reserved].sort((left, right) => left - right)).toEqual(
      Array.from({ length: 25 }, (_, index) => index + 1),
    );
  });

  it('rolls the reservation back with the surrounding transaction', async () => {
    await prisma.quoteSequence.deleteMany({ where: { year } });

    await expect(
      prisma.$transaction(async (tx) => {
        await sequence.reserveInTransaction(tx, year);
        throw new Error('forced rollback');
      }),
    ).rejects.toThrow('forced rollback');

    expect(
      await prisma.quoteSequence.findUnique({ where: { year } }),
    ).toBeNull();
  });

  it('keeps the unique constraint as the final defense', async () => {
    const quoteNumber = `ORÇ-${year}-9999`;
    const customer = await prisma.customer.create({
      data: {
        name: `Sequence Test ${randomUUID()}`,
        phone: '11999999999',
      },
    });

    try {
      await prisma.quote.create({
        data: {
          quoteNumber,
          customerId: customer.id,
          status: QuoteStatus.DRAFT,
        },
      });

      await expect(
        prisma.quote.create({
          data: {
            quoteNumber,
            customerId: customer.id,
            status: QuoteStatus.DRAFT,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    } finally {
      await prisma.quote.deleteMany({ where: { customerId: customer.id } });
      await prisma.customer.delete({ where: { id: customer.id } });
    }
  });

  it('rejects an invalid year', async () => {
    await expect(sequence.reserveInTransaction(prisma, 0)).rejects.toThrow(
      RangeError,
    );
    await expect(sequence.reserveInTransaction(prisma, 2026.5)).rejects.toThrow(
      RangeError,
    );
  });
});
