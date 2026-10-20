import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { InvalidQuoteTransitionError } from '../../domain/errors/quote-domain.errors.js';
import { PrismaQuoteRepository } from '../../infrastructure/persistence/prisma-quote.repository.js';
import { PrismaQuoteSequence } from '../../infrastructure/persistence/prisma-quote-sequence.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { RemoveInstallationUseCase } from './remove-installation.use-case.js';

type SeedStatus =
  'DRAFT' | 'SENT' | 'CONFIRMED' | 'IN_PRODUCTION' | 'COMPLETED' | 'CANCELLED';

describe('RemoveInstallationUseCase integration', () => {
  const year = randomInt(1_000, 1_999);
  const scheduledInstallationAt = new Date('2026-11-02T14:30:00.000Z');
  const customerId = randomUUID();
  let prisma: PrismaService;
  let useCase: RemoveInstallationUseCase;
  let quoteCounter = 0;

  function nextQuoteNumber(): string {
    quoteCounter += 1;

    return `ORÇ-${year}-${String(quoteCounter).padStart(3, '0')}`;
  }

  async function seedQuote(
    status: SeedStatus,
    installation: Date | null = scheduledInstallationAt,
  ): Promise<{ id: string; updatedAt: Date }> {
    const id = randomUUID();

    const stored = await prisma.quote.create({
      data: {
        id,
        quoteNumber: nextQuoteNumber(),
        customerId,
        status,
        scheduledInstallationAt: installation,
      },
    });

    return { id, updatedAt: stored.updatedAt };
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

    useCase = new RemoveInstallationUseCase(
      new PrismaQuoteRepository(prisma, new PrismaQuoteSequence(prisma)),
    );

    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Quote Remove Installation ${randomUUID()}`,
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

  it.each(['CONFIRMED', 'IN_PRODUCTION'] as const)(
    'removes the installation from a %s quote',
    async (status) => {
      const seeded = await seedQuote(status);

      const quote = await useCase.execute({ id: seeded.id });

      expect(quote.scheduledInstallationAt).toBeNull();

      const stored = await prisma.quote.findUniqueOrThrow({
        where: { id: seeded.id },
      });
      const history = await historyOf(seeded.id);

      expect(stored.scheduledInstallationAt).toBeNull();
      expect(history).toHaveLength(1);
      expect(history[0].eventType).toBe('INSTALLATION_REMOVED');
      expect(history[0].details).toEqual({
        previousScheduledInstallationAt: scheduledInstallationAt.toISOString(),
      });
    },
  );

  it('does nothing when there is no installation to remove', async () => {
    const seeded = await seedQuote('CONFIRMED', null);

    const quote = await useCase.execute({ id: seeded.id });

    expect(quote.scheduledInstallationAt).toBeNull();

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });

    expect(stored.updatedAt.getTime()).toBe(seeded.updatedAt.getTime());
    expect(await historyOf(seeded.id)).toHaveLength(0);
  });

  it.each(['DRAFT', 'SENT', 'COMPLETED', 'CANCELLED'] as const)(
    'rejects removal from %s',
    async (status) => {
      const seeded = await seedQuote(status);

      await expect(useCase.execute({ id: seeded.id })).rejects.toBeInstanceOf(
        InvalidQuoteTransitionError,
      );

      const stored = await prisma.quote.findUniqueOrThrow({
        where: { id: seeded.id },
      });

      expect(stored.status).toBe(status);
      expect(stored.scheduledInstallationAt?.toISOString()).toBe(
        scheduledInstallationAt.toISOString(),
      );
      expect(await historyOf(seeded.id)).toHaveLength(0);
    },
  );
});
