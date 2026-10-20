import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { QuoteStatus } from '../../domain/entities/quote.js';
import { InvalidQuoteTransitionError } from '../../domain/errors/quote-domain.errors.js';
import { PrismaQuoteRepository } from '../../infrastructure/persistence/prisma-quote.repository.js';
import { PrismaQuoteSequence } from '../../infrastructure/persistence/prisma-quote-sequence.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { CancelQuoteUseCase } from './cancel-quote.use-case.js';

describe('CancelQuoteUseCase integration', () => {
  // Reserved year band; parallel integration specs use disjoint ranges.
  const year = randomInt(2_900, 2_999);
  const customerId = randomUUID();
  let prisma: PrismaService;
  let useCase: CancelQuoteUseCase;
  let quoteCounter = 0;

  function nextQuoteNumber(): string {
    quoteCounter += 1;

    return `ORÇ-${year}-${String(quoteCounter).padStart(3, '0')}`;
  }

  async function seedQuote(
    status:
      | 'DRAFT'
      | 'SENT'
      | 'CONFIRMED'
      | 'IN_PRODUCTION'
      | 'COMPLETED'
      | 'CANCELLED',
  ): Promise<{ id: string }> {
    const id = randomUUID();

    await prisma.quote.create({
      data: {
        id,
        quoteNumber: nextQuoteNumber(),
        customerId,
        status,
      },
    });

    return { id };
  }

  function historyOf(quoteId: string) {
    return prisma.quoteHistory.findMany({
      where: { quoteId },
      orderBy: { occurredAt: 'asc' },
    });
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    useCase = new CancelQuoteUseCase(
      new PrismaQuoteRepository(prisma, new PrismaQuoteSequence(prisma)),
    );

    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Quote Cancel ${randomUUID()}`,
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
    await expect(useCase.execute({ id: randomUUID() })).rejects.toBeInstanceOf(
      QuoteNotFoundError,
    );
  });

  it.each(['DRAFT', 'SENT', 'CONFIRMED'] as const)(
    'cancels a %s quote with a normalized reason',
    async (status) => {
      const seeded = await seedQuote(status);

      const quote = await useCase.execute({
        id: seeded.id,
        reason: '  Cliente desistiu  ',
      });

      expect(quote.status).toBe(QuoteStatus.CANCELLED);

      const stored = await prisma.quote.findUniqueOrThrow({
        where: { id: seeded.id },
      });
      const history = await historyOf(seeded.id);

      expect(stored.status).toBe('CANCELLED');
      expect(history).toHaveLength(1);
      expect(history[0].eventType).toBe('QUOTE_CANCELLED');
      expect(history[0].details).toEqual({ reason: 'Cliente desistiu' });
    },
  );

  it('records an empty payload when no reason is informed', async () => {
    const seeded = await seedQuote('SENT');

    await useCase.execute({ id: seeded.id });

    const history = await historyOf(seeded.id);

    expect(history).toHaveLength(1);
    expect(history[0].details).toEqual({});
  });

  it.each(['IN_PRODUCTION', 'COMPLETED', 'CANCELLED'] as const)(
    'rejects cancellation from %s',
    async (status) => {
      const seeded = await seedQuote(status);

      await expect(
        useCase.execute({ id: seeded.id, reason: 'Motivo' }),
      ).rejects.toBeInstanceOf(InvalidQuoteTransitionError);

      const stored = await prisma.quote.findUniqueOrThrow({
        where: { id: seeded.id },
      });

      expect(stored.status).toBe(status);
      expect(await historyOf(seeded.id)).toHaveLength(0);
    },
  );

  it('rejects a reason longer than 500 characters', async () => {
    const seeded = await seedQuote('DRAFT');

    await expect(
      useCase.execute({ id: seeded.id, reason: 'a'.repeat(501) }),
    ).rejects.toThrow(RangeError);

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });

    expect(stored.status).toBe('DRAFT');
    expect(await historyOf(seeded.id)).toHaveLength(0);
  });
});
