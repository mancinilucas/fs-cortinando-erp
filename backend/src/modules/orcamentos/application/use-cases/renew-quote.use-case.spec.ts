import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { QuoteStatus } from '../../domain/entities/quote.js';
import {
  InvalidQuoteTransitionError,
  QuoteValidationError,
} from '../../domain/errors/quote-domain.errors.js';
import { PrismaQuoteRepository } from '../../infrastructure/persistence/prisma-quote.repository.js';
import { PrismaQuoteSequence } from '../../infrastructure/persistence/prisma-quote-sequence.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { RenewQuoteUseCase } from './renew-quote.use-case.js';

describe('RenewQuoteUseCase integration', () => {
  const year = randomInt(7_000, 7_999);
  const now = new Date('2026-10-19T12:00:00.000Z');
  const newValidUntil = new Date('2026-12-01T12:00:00.000Z');
  const customerId = randomUUID();
  let prisma: PrismaService;
  let useCase: RenewQuoteUseCase;
  let quoteCounter = 0;

  function nextQuoteNumber(): string {
    quoteCounter += 1;

    return `ORÇ-${year}-${String(quoteCounter).padStart(3, '0')}`;
  }

  async function seedQuote(input: {
    status?: 'DRAFT' | 'SENT' | 'CONFIRMED';
    firstSentAt?: Date | null;
    validUntil?: Date | null;
  }): Promise<{ id: string; quoteNumber: string }> {
    const id = randomUUID();
    const quoteNumber = nextQuoteNumber();

    await prisma.quote.create({
      data: {
        id,
        quoteNumber,
        customerId,
        status: input.status ?? 'SENT',
        firstSentAt: input.firstSentAt ?? null,
        validUntil: input.validUntil ?? null,
      },
    });

    return { id, quoteNumber };
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

    useCase = new RenewQuoteUseCase(
      new PrismaQuoteRepository(prisma, new PrismaQuoteSequence(prisma)),
      { now: () => new Date(now) },
    );

    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Quote Renew ${randomUUID()}`,
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
      useCase.execute({ id: randomUUID(), validUntil: newValidUntil }),
    ).rejects.toBeInstanceOf(QuoteNotFoundError);
  });

  it('renews an expired quote and records both validities', async () => {
    const previousValidUntil = new Date('2026-10-01T12:00:00.000Z');
    const firstSentAt = new Date('2026-09-01T12:00:00.000Z');
    const seeded = await seedQuote({
      firstSentAt,
      validUntil: previousValidUntil,
    });

    const quote = await useCase.execute({
      id: seeded.id,
      validUntil: newValidUntil,
    });

    expect(quote.status).toBe(QuoteStatus.SENT);
    expect(quote.validUntil?.toISOString()).toBe(newValidUntil.toISOString());
    expect(quote.firstSentAt?.toISOString()).toBe(firstSentAt.toISOString());
    expect(quote.quoteNumber.value).toBe(seeded.quoteNumber);
    expect(quote.isExpired(now)).toBe(false);

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });
    const history = await historyOf(seeded.id);

    expect(stored.status).toBe('SENT');
    expect(stored.validUntil?.toISOString()).toBe(newValidUntil.toISOString());
    expect(stored.firstSentAt?.toISOString()).toBe(firstSentAt.toISOString());
    expect(stored.quoteNumber).toBe(seeded.quoteNumber);
    expect(history).toHaveLength(1);
    expect(history[0].eventType).toBe('QUOTE_RENEWED');
    expect(history[0].details).toEqual({
      previousValidUntil: previousValidUntil.toISOString(),
      newValidUntil: newValidUntil.toISOString(),
    });
  });

  it('renews a quote that is still valid', async () => {
    const previousValidUntil = new Date('2026-11-01T12:00:00.000Z');
    const seeded = await seedQuote({
      firstSentAt: new Date('2026-10-01T12:00:00.000Z'),
      validUntil: previousValidUntil,
    });

    const quote = await useCase.execute({
      id: seeded.id,
      validUntil: newValidUntil,
    });

    expect(quote.status).toBe(QuoteStatus.SENT);
    expect(quote.validUntil?.toISOString()).toBe(newValidUntil.toISOString());
    expect(await historyOf(seeded.id)).toHaveLength(1);
  });

  it('rejects a new validity that is not strictly future', async () => {
    const previousValidUntil = new Date('2026-10-01T12:00:00.000Z');
    const seeded = await seedQuote({
      firstSentAt: new Date('2026-09-01T12:00:00.000Z'),
      validUntil: previousValidUntil,
    });

    const error = await useCase
      .execute({
        id: seeded.id,
        validUntil: new Date('2026-10-19T12:00:00.000Z'),
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(QuoteValidationError);
    expect(
      (error as QuoteValidationError).violations.map((item) => item.code),
    ).toContain('VALID_UNTIL_NOT_FUTURE');

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });

    expect(stored.validUntil?.toISOString()).toBe(
      previousValidUntil.toISOString(),
    );
    expect(await historyOf(seeded.id)).toHaveLength(0);
  });

  it('rejects renewal when a SENT quote has no validity', async () => {
    const seeded = await seedQuote({ validUntil: null });

    await expect(
      useCase.execute({ id: seeded.id, validUntil: newValidUntil }),
    ).rejects.toBeInstanceOf(InvalidQuoteTransitionError);
    expect(await historyOf(seeded.id)).toHaveLength(0);
  });

  it.each(['DRAFT', 'CONFIRMED'] as const)(
    'rejects renewal from %s',
    async (status) => {
      const seeded = await seedQuote({
        status,
        validUntil: new Date('2026-11-01T12:00:00.000Z'),
      });

      await expect(
        useCase.execute({ id: seeded.id, validUntil: newValidUntil }),
      ).rejects.toBeInstanceOf(InvalidQuoteTransitionError);

      const stored = await prisma.quote.findUniqueOrThrow({
        where: { id: seeded.id },
      });

      expect(stored.status).toBe(status);
      expect(await historyOf(seeded.id)).toHaveLength(0);
    },
  );
});
