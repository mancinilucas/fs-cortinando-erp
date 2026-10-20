import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { InvalidQuoteTransitionError } from '../../domain/errors/quote-domain.errors.js';
import { PrismaQuoteRepository } from '../../infrastructure/persistence/prisma-quote.repository.js';
import { PrismaQuoteSequence } from '../../infrastructure/persistence/prisma-quote-sequence.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { ScheduleInstallationUseCase } from './schedule-installation.use-case.js';

type SeedStatus =
  'DRAFT' | 'SENT' | 'CONFIRMED' | 'IN_PRODUCTION' | 'COMPLETED' | 'CANCELLED';

describe('ScheduleInstallationUseCase integration', () => {
  // Reserved year band; parallel integration specs use disjoint ranges.
  const year = randomInt(1_500, 1_599);
  const now = new Date('2026-10-19T12:00:00.000Z');
  const customerId = randomUUID();
  let prisma: PrismaService;
  let useCase: ScheduleInstallationUseCase;
  let quoteCounter = 0;

  function nextQuoteNumber(): string {
    quoteCounter += 1;

    return `ORÇ-${year}-${String(quoteCounter).padStart(3, '0')}`;
  }

  async function seedQuote(
    status: SeedStatus,
    scheduledInstallationAt: Date | null = null,
  ): Promise<{ id: string; updatedAt: Date }> {
    const id = randomUUID();

    const stored = await prisma.quote.create({
      data: {
        id,
        quoteNumber: nextQuoteNumber(),
        customerId,
        status,
        scheduledInstallationAt,
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

    useCase = new ScheduleInstallationUseCase(
      new PrismaQuoteRepository(prisma, new PrismaQuoteSequence(prisma)),
    );

    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Quote Schedule ${randomUUID()}`,
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
    await expect(
      useCase.execute({ id: randomUUID(), scheduledInstallationAt: now }),
    ).rejects.toBeInstanceOf(QuoteNotFoundError);
  });

  it.each(['CONFIRMED', 'IN_PRODUCTION'] as const)(
    'schedules an installation on a %s quote',
    async (status) => {
      const seeded = await seedQuote(status);

      const quote = await useCase.execute({
        id: seeded.id,
        scheduledInstallationAt: now,
      });

      expect(quote.scheduledInstallationAt?.toISOString()).toBe(
        now.toISOString(),
      );

      const stored = await prisma.quote.findUniqueOrThrow({
        where: { id: seeded.id },
      });
      const history = await historyOf(seeded.id);

      expect(stored.scheduledInstallationAt?.toISOString()).toBe(
        now.toISOString(),
      );
      expect(history).toHaveLength(1);
      expect(history[0].eventType).toBe('INSTALLATION_SCHEDULED');
      expect(history[0].details).toEqual({
        scheduledInstallationAt: now.toISOString(),
      });
    },
  );

  it('replaces an existing installation and records both instants', async () => {
    const previous = new Date('2026-10-25T09:00:00.000Z');
    const next = new Date('2026-11-02T14:30:00.000Z');
    const seeded = await seedQuote('IN_PRODUCTION', previous);

    const quote = await useCase.execute({
      id: seeded.id,
      scheduledInstallationAt: next,
    });

    expect(quote.scheduledInstallationAt?.toISOString()).toBe(
      next.toISOString(),
    );

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });
    const history = await historyOf(seeded.id);

    expect(stored.scheduledInstallationAt?.toISOString()).toBe(
      next.toISOString(),
    );
    expect(history).toHaveLength(1);
    expect(history[0].eventType).toBe('INSTALLATION_CHANGED');
    expect(history[0].details).toEqual({
      previousScheduledInstallationAt: previous.toISOString(),
      scheduledInstallationAt: next.toISOString(),
    });
  });

  it('does nothing when the instant is unchanged', async () => {
    const scheduledInstallationAt = new Date('2026-10-25T09:00:00.000Z');
    const seeded = await seedQuote('CONFIRMED', scheduledInstallationAt);

    const quote = await useCase.execute({
      id: seeded.id,
      scheduledInstallationAt: new Date(scheduledInstallationAt),
    });

    expect(quote.scheduledInstallationAt?.toISOString()).toBe(
      scheduledInstallationAt.toISOString(),
    );

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });

    expect(stored.updatedAt.getTime()).toBe(seeded.updatedAt.getTime());
    expect(await historyOf(seeded.id)).toHaveLength(0);
  });

  it.each(['CONFIRMED', 'IN_PRODUCTION'] as const)(
    'accepts a past instant on a %s quote and derives a late installation',
    async (status) => {
      const past = new Date('2026-10-10T08:00:00.000Z');
      const seeded = await seedQuote(status);

      const quote = await useCase.execute({
        id: seeded.id,
        scheduledInstallationAt: past,
      });

      expect(quote.isLateInstallation(now)).toBe(true);
    },
  );

  it.each(['DRAFT', 'SENT', 'COMPLETED', 'CANCELLED'] as const)(
    'rejects scheduling from %s',
    async (status) => {
      const seeded = await seedQuote(status);

      await expect(
        useCase.execute({ id: seeded.id, scheduledInstallationAt: now }),
      ).rejects.toBeInstanceOf(InvalidQuoteTransitionError);

      const stored = await prisma.quote.findUniqueOrThrow({
        where: { id: seeded.id },
      });

      expect(stored.status).toBe(status);
      expect(stored.scheduledInstallationAt).toBeNull();
      expect(await historyOf(seeded.id)).toHaveLength(0);
    },
  );
});
