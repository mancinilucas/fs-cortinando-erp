import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { QuoteStatus } from '../../domain/entities/quote.js';
import { InvalidQuoteTransitionError } from '../../domain/errors/quote-domain.errors.js';
import { PrismaQuoteRepository } from '../../infrastructure/persistence/prisma-quote.repository.js';
import { PrismaQuoteSequence } from '../../infrastructure/persistence/prisma-quote-sequence.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { CancelQuoteUseCase } from './cancel-quote.use-case.js';
import { CompleteServiceUseCase } from './complete-service.use-case.js';
import { ScheduleInstallationUseCase } from './schedule-installation.use-case.js';

type SeedStatus =
  'DRAFT' | 'SENT' | 'CONFIRMED' | 'IN_PRODUCTION' | 'COMPLETED' | 'CANCELLED';

describe('CompleteServiceUseCase integration', () => {
  // Reserved year band; parallel integration specs use disjoint ranges.
  const year = randomInt(2_200, 2_299);
  const now = new Date('2026-10-19T12:00:00.000Z');
  const customerId = randomUUID();
  let prisma: PrismaService;
  let repository: PrismaQuoteRepository;
  let useCase: CompleteServiceUseCase;
  let quoteCounter = 0;

  function nextQuoteNumber(): string {
    quoteCounter += 1;

    return `ORÇ-${year}-${String(quoteCounter).padStart(3, '0')}`;
  }

  async function seedQuote(
    status: SeedStatus,
    scheduledInstallationAt: Date | null = null,
  ): Promise<{ id: string }> {
    const id = randomUUID();

    await prisma.quote.create({
      data: {
        id,
        quoteNumber: nextQuoteNumber(),
        customerId,
        status,
        scheduledInstallationAt,
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

    repository = new PrismaQuoteRepository(
      prisma,
      new PrismaQuoteSequence(prisma),
    );
    useCase = new CompleteServiceUseCase(repository, {
      now: () => new Date(now),
    });

    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Quote Complete ${randomUUID()}`,
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

  it('completes a quote without installation', async () => {
    const seeded = await seedQuote('IN_PRODUCTION');

    const quote = await useCase.execute({ id: seeded.id });

    expect(quote.status).toBe(QuoteStatus.COMPLETED);
    expect(quote.completedAt?.toISOString()).toBe(now.toISOString());

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });
    const history = await historyOf(seeded.id);

    expect(stored.status).toBe('COMPLETED');
    expect(stored.completedAt?.toISOString()).toBe(now.toISOString());
    expect(history).toHaveLength(1);
    expect(history[0].eventType).toBe('SERVICE_COMPLETED');
    expect(history[0].details).toBeNull();
  });

  it.each([
    new Date('2026-10-10T09:00:00.000Z'),
    new Date('2026-10-19T12:00:00.000Z'),
  ])('completes with an installation at %s', async (installation) => {
    const seeded = await seedQuote('IN_PRODUCTION', installation);

    const quote = await useCase.execute({ id: seeded.id });

    expect(quote.status).toBe(QuoteStatus.COMPLETED);
    expect(await historyOf(seeded.id)).toHaveLength(1);
  });

  it('blocks completion while the installation is in the future', async () => {
    const seeded = await seedQuote(
      'IN_PRODUCTION',
      new Date('2026-10-20T09:00:00.000Z'),
    );

    await expect(useCase.execute({ id: seeded.id })).rejects.toBeInstanceOf(
      InvalidQuoteTransitionError,
    );

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });

    expect(stored.status).toBe('IN_PRODUCTION');
    expect(stored.completedAt).toBeNull();
    expect(await historyOf(seeded.id)).toHaveLength(0);
  });

  it.each(['DRAFT', 'SENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const)(
    'rejects completion from %s',
    async (status) => {
      const seeded = await seedQuote(status);

      await expect(useCase.execute({ id: seeded.id })).rejects.toBeInstanceOf(
        InvalidQuoteTransitionError,
      );

      const stored = await prisma.quote.findUniqueOrThrow({
        where: { id: seeded.id },
      });

      expect(stored.status).toBe(status);
      expect(stored.completedAt).toBeNull();
      expect(await historyOf(seeded.id)).toHaveLength(0);
    },
  );

  it('is terminal after completion', async () => {
    const seeded = await seedQuote('IN_PRODUCTION');

    await useCase.execute({ id: seeded.id });

    await expect(useCase.execute({ id: seeded.id })).rejects.toBeInstanceOf(
      InvalidQuoteTransitionError,
    );
    await expect(
      new CancelQuoteUseCase(repository).execute({ id: seeded.id }),
    ).rejects.toBeInstanceOf(InvalidQuoteTransitionError);
    await expect(
      new ScheduleInstallationUseCase(repository).execute({
        id: seeded.id,
        scheduledInstallationAt: new Date('2026-10-25T09:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(InvalidQuoteTransitionError);

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });
    const history = await historyOf(seeded.id);

    expect(stored.status).toBe('COMPLETED');
    expect(history).toHaveLength(1);
    expect(history[0].eventType).toBe('SERVICE_COMPLETED');
  });
});
