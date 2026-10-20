import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { QuoteStatus } from '../../domain/entities/quote.js';
import { InvalidQuoteTransitionError } from '../../domain/errors/quote-domain.errors.js';
import { PrismaQuoteRepository } from '../../infrastructure/persistence/prisma-quote.repository.js';
import { PrismaQuoteSequence } from '../../infrastructure/persistence/prisma-quote-sequence.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { CancelQuoteUseCase } from './cancel-quote.use-case.js';
import { StartProductionUseCase } from './start-production.use-case.js';

type SeedStatus =
  'DRAFT' | 'SENT' | 'CONFIRMED' | 'IN_PRODUCTION' | 'COMPLETED' | 'CANCELLED';

describe('StartProductionUseCase integration', () => {
  const year = randomInt(9_000, 9_999);
  const now = new Date('2026-10-19T12:00:00.000Z');
  const customerId = randomUUID();
  let prisma: PrismaService;
  let useCase: StartProductionUseCase;
  let quoteCounter = 0;

  function nextQuoteNumber(): string {
    quoteCounter += 1;

    return `ORÇ-${year}-${String(quoteCounter).padStart(3, '0')}`;
  }

  async function seedQuote(status: SeedStatus): Promise<{ id: string }> {
    const id = randomUUID();

    await prisma.quote.create({
      data: { id, quoteNumber: nextQuoteNumber(), customerId, status },
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

    useCase = new StartProductionUseCase(
      new PrismaQuoteRepository(prisma, new PrismaQuoteSequence(prisma)),
      { now: () => new Date(now) },
    );

    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Quote Production ${randomUUID()}`,
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

  it('starts production from CONFIRMED and records the instant', async () => {
    const seeded = await seedQuote('CONFIRMED');

    const quote = await useCase.execute({ id: seeded.id });

    expect(quote.status).toBe(QuoteStatus.IN_PRODUCTION);
    expect(quote.productionStartedAt?.toISOString()).toBe(now.toISOString());

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });
    const history = await historyOf(seeded.id);

    expect(stored.status).toBe('IN_PRODUCTION');
    expect(stored.productionStartedAt?.toISOString()).toBe(now.toISOString());
    expect(history).toHaveLength(1);
    expect(history[0].eventType).toBe('PRODUCTION_STARTED');
    expect(history[0].details).toBeNull();
  });

  it.each([
    'DRAFT',
    'SENT',
    'IN_PRODUCTION',
    'COMPLETED',
    'CANCELLED',
  ] as const)('rejects production start from %s', async (status) => {
    const seeded = await seedQuote(status);

    await expect(useCase.execute({ id: seeded.id })).rejects.toBeInstanceOf(
      InvalidQuoteTransitionError,
    );

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });

    expect(stored.status).toBe(status);
    expect(stored.productionStartedAt).toBeNull();
    expect(await historyOf(seeded.id)).toHaveLength(0);
  });

  it('blocks cancellation after production starts', async () => {
    const seeded = await seedQuote('CONFIRMED');
    const repository = new PrismaQuoteRepository(
      prisma,
      new PrismaQuoteSequence(prisma),
    );

    await new StartProductionUseCase(repository, {
      now: () => new Date(now),
    }).execute({ id: seeded.id });

    await expect(
      new CancelQuoteUseCase(repository).execute({ id: seeded.id }),
    ).rejects.toBeInstanceOf(InvalidQuoteTransitionError);

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });

    expect(stored.status).toBe('IN_PRODUCTION');
    expect(await historyOf(seeded.id)).toHaveLength(1);
  });
});
