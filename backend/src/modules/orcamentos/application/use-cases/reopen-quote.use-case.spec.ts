import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { QuoteStatus } from '../../domain/entities/quote.js';
import { InvalidQuoteTransitionError } from '../../domain/errors/quote-domain.errors.js';
import { PrismaQuoteRepository } from '../../infrastructure/persistence/prisma-quote.repository.js';
import { PrismaQuoteSequence } from '../../infrastructure/persistence/prisma-quote-sequence.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { ReopenQuoteUseCase } from './reopen-quote.use-case.js';

describe('ReopenQuoteUseCase integration', () => {
  const year = randomInt(6_000, 6_999);
  const now = new Date('2026-10-19T12:00:00.000Z');
  const customerId = randomUUID();
  let prisma: PrismaService;
  let useCase: ReopenQuoteUseCase;
  let quoteCounter = 0;

  function nextQuoteNumber(): string {
    quoteCounter += 1;

    return `ORÇ-${year}-${String(quoteCounter).padStart(3, '0')}`;
  }

  async function seedQuote(input: {
    status?: 'DRAFT' | 'SENT' | 'CONFIRMED';
    confirmedAt?: Date | null;
    scheduledInstallationAt?: Date | null;
    firstSentAt?: Date | null;
    validUntil?: Date | null;
  }): Promise<{ id: string }> {
    const id = randomUUID();

    await prisma.quote.create({
      data: {
        id,
        quoteNumber: nextQuoteNumber(),
        customerId,
        status: input.status ?? 'CONFIRMED',
        firstSentAt: input.firstSentAt ?? null,
        validUntil: input.validUntil ?? null,
        confirmedAt: input.confirmedAt ?? null,
        scheduledInstallationAt: input.scheduledInstallationAt ?? null,
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

    useCase = new ReopenQuoteUseCase(
      new PrismaQuoteRepository(prisma, new PrismaQuoteSequence(prisma)),
    );

    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Quote Reopen ${randomUUID()}`,
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

  it('clears confirmation and installation while preserving the sent dates', async () => {
    const firstSentAt = new Date('2026-10-01T12:00:00.000Z');
    const validUntil = new Date('2026-11-18T12:00:00.000Z');
    const confirmedAt = new Date('2026-10-05T12:00:00.000Z');
    const scheduled = new Date('2026-11-01T12:00:00.000Z');
    const seeded = await seedQuote({
      firstSentAt,
      validUntil,
      confirmedAt,
      scheduledInstallationAt: scheduled,
    });

    const quote = await useCase.execute({ id: seeded.id });

    expect(quote.status).toBe(QuoteStatus.SENT);
    expect(quote.confirmedAt).toBeNull();
    expect(quote.scheduledInstallationAt).toBeNull();
    expect(quote.firstSentAt?.toISOString()).toBe(firstSentAt.toISOString());
    expect(quote.validUntil?.toISOString()).toBe(validUntil.toISOString());

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });
    const history = await historyOf(seeded.id);

    expect(stored.status).toBe('SENT');
    expect(stored.confirmedAt).toBeNull();
    expect(stored.scheduledInstallationAt).toBeNull();
    expect(stored.firstSentAt?.toISOString()).toBe(firstSentAt.toISOString());
    expect(stored.validUntil?.toISOString()).toBe(validUntil.toISOString());
    expect(history).toHaveLength(1);
    expect(history[0].eventType).toBe('QUOTE_REOPENED');
    expect(history[0].details).toEqual({
      previousConfirmedAt: confirmedAt.toISOString(),
      previousScheduledInstallationAt: scheduled.toISOString(),
    });
  });

  it('records null previous values when reopening without a schedule', async () => {
    const confirmedAt = new Date('2026-10-05T12:00:00.000Z');
    const seeded = await seedQuote({
      firstSentAt: new Date('2026-10-01T12:00:00.000Z'),
      validUntil: new Date('2026-11-18T12:00:00.000Z'),
      confirmedAt,
    });

    await useCase.execute({ id: seeded.id });

    const history = await historyOf(seeded.id);

    expect(history[0].details).toEqual({
      previousConfirmedAt: confirmedAt.toISOString(),
      previousScheduledInstallationAt: null,
    });
  });

  it('reopens as expired when the preserved validity has already elapsed', async () => {
    const seeded = await seedQuote({
      firstSentAt: new Date('2026-09-01T12:00:00.000Z'),
      validUntil: new Date('2026-10-01T12:00:00.000Z'),
      confirmedAt: new Date('2026-09-10T12:00:00.000Z'),
    });

    const quote = await useCase.execute({ id: seeded.id });

    expect(quote.status).toBe(QuoteStatus.SENT);
    expect(quote.isExpired(now)).toBe(true);
    expect(quote.validUntil?.toISOString()).toBe('2026-10-01T12:00:00.000Z');
    expect(await historyOf(seeded.id)).toHaveLength(1);
  });

  it.each(['DRAFT', 'SENT'] as const)(
    'rejects reopening a %s quote',
    async (status) => {
      const seeded = await seedQuote({ status });

      await expect(useCase.execute({ id: seeded.id })).rejects.toBeInstanceOf(
        InvalidQuoteTransitionError,
      );

      const stored = await prisma.quote.findUniqueOrThrow({
        where: { id: seeded.id },
      });

      expect(stored.status).toBe(status);
      expect(await historyOf(seeded.id)).toHaveLength(0);
    },
  );
});
