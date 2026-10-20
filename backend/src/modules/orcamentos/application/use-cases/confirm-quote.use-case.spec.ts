import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { Quote, QuoteStatus } from '../../domain/entities/quote.js';
import { InvalidQuoteTransitionError } from '../../domain/errors/quote-domain.errors.js';
import type { QuoteHistoryEventDraft } from '../../domain/history/quote-history.js';
import type { QuoteMutation } from '../../domain/repositories/quote.repository.js';
import { PrismaQuoteRepository } from '../../infrastructure/persistence/prisma-quote.repository.js';
import { PrismaQuoteSequence } from '../../infrastructure/persistence/prisma-quote-sequence.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { ConfirmQuoteUseCase } from './confirm-quote.use-case.js';

// Forced persistence failure so the transaction rolls back.
class CircularHistoryRepository extends PrismaQuoteRepository {
  override async mutate(
    id: string,
    operation: QuoteMutation,
  ): Promise<Quote | null> {
    return super.mutate(id, (quote) => {
      const event = operation(quote);

      if (event === null) {
        return null;
      }

      const circular: Record<string, unknown> = {};
      circular.self = circular;

      return {
        ...event,
        details: circular,
      } as unknown as QuoteHistoryEventDraft;
    });
  }
}

describe('ConfirmQuoteUseCase integration', () => {
  // Reserved year band; parallel integration specs use disjoint ranges.
  const year = randomInt(2_600, 2_699);
  const now = new Date('2026-10-19T12:00:00.000Z');
  const customerId = randomUUID();
  let prisma: PrismaService;
  let useCase: ConfirmQuoteUseCase;
  let quoteCounter = 0;

  function nextQuoteNumber(): string {
    quoteCounter += 1;

    return `ORÇ-${year}-${String(quoteCounter).padStart(3, '0')}`;
  }

  async function seedQuote(input: {
    status?: 'DRAFT' | 'SENT' | 'CONFIRMED';
    validUntil?: Date | null;
  }): Promise<{ id: string }> {
    const id = randomUUID();

    await prisma.quote.create({
      data: {
        id,
        quoteNumber: nextQuoteNumber(),
        customerId,
        status: input.status ?? 'SENT',
        installationAddressPostalCode: '01310100',
        installationAddressStreet: 'Avenida Paulista',
        installationAddressNumber: '1000',
        installationAddressNeighborhood: 'Bela Vista',
        installationAddressCity: 'São Paulo',
        installationAddressState: 'SP',
        firstSentAt: new Date('2026-10-01T12:00:00.000Z'),
        validUntil: input.validUntil ?? null,
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

  async function expectStillSent(quoteId: string): Promise<void> {
    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: quoteId },
    });

    expect(stored.status).toBe('SENT');
    expect(stored.confirmedAt).toBeNull();
    expect(await historyOf(quoteId)).toHaveLength(0);
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    useCase = new ConfirmQuoteUseCase(
      new PrismaQuoteRepository(prisma, new PrismaQuoteSequence(prisma)),
      { now: () => new Date(now) },
    );

    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Quote Confirm ${randomUUID()}`,
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

  it('confirms a valid SENT quote and records QUOTE_CONFIRMED', async () => {
    const seeded = await seedQuote({
      validUntil: new Date('2026-11-18T12:00:00.000Z'),
    });

    const quote = await useCase.execute({ id: seeded.id });

    expect(quote.status).toBe(QuoteStatus.CONFIRMED);
    expect(quote.confirmedAt?.toISOString()).toBe(now.toISOString());

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });
    const history = await historyOf(seeded.id);

    expect(stored.status).toBe('CONFIRMED');
    expect(stored.confirmedAt?.toISOString()).toBe(now.toISOString());
    expect(history).toHaveLength(1);
    expect(history[0].eventType).toBe('QUOTE_CONFIRMED');
    expect(history[0].details).toBeNull();
  });

  it('confirms exactly on the validity limit', async () => {
    const seeded = await seedQuote({ validUntil: new Date(now) });

    const quote = await useCase.execute({ id: seeded.id });

    expect(quote.status).toBe(QuoteStatus.CONFIRMED);
  });

  it('blocks confirmation after expiry', async () => {
    const seeded = await seedQuote({
      validUntil: new Date('2026-10-19T11:59:59.000Z'),
    });

    await expect(useCase.execute({ id: seeded.id })).rejects.toBeInstanceOf(
      InvalidQuoteTransitionError,
    );
    await expectStillSent(seeded.id);
  });

  it('blocks confirmation when the SENT quote has no validity', async () => {
    const seeded = await seedQuote({ validUntil: null });

    await expect(useCase.execute({ id: seeded.id })).rejects.toBeInstanceOf(
      InvalidQuoteTransitionError,
    );
    await expectStillSent(seeded.id);
  });

  it('blocks confirmation from DRAFT', async () => {
    const seeded = await seedQuote({
      status: 'DRAFT',
      validUntil: new Date('2026-11-18T12:00:00.000Z'),
    });

    await expect(useCase.execute({ id: seeded.id })).rejects.toBeInstanceOf(
      InvalidQuoteTransitionError,
    );

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });

    expect(stored.status).toBe('DRAFT');
    expect(stored.confirmedAt).toBeNull();
  });

  it('blocks confirmation from CONFIRMED', async () => {
    const seeded = await seedQuote({
      status: 'CONFIRMED',
      validUntil: new Date('2026-11-18T12:00:00.000Z'),
    });

    await expect(useCase.execute({ id: seeded.id })).rejects.toBeInstanceOf(
      InvalidQuoteTransitionError,
    );
  });

  it('lets only one of two concurrent confirmations win', async () => {
    const seeded = await seedQuote({
      validUntil: new Date('2026-11-18T12:00:00.000Z'),
    });

    const results = await Promise.allSettled([
      useCase.execute({ id: seeded.id }),
      useCase.execute({ id: seeded.id }),
    ]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      InvalidQuoteTransitionError,
    );

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });

    expect(stored.status).toBe('CONFIRMED');
    expect(await historyOf(seeded.id)).toHaveLength(1);
  });

  it('rolls the confirmation back when persistence fails', async () => {
    const seeded = await seedQuote({
      validUntil: new Date('2026-11-18T12:00:00.000Z'),
    });
    const failingUseCase = new ConfirmQuoteUseCase(
      new CircularHistoryRepository(prisma, new PrismaQuoteSequence(prisma)),
      { now: () => new Date(now) },
    );

    await expect(failingUseCase.execute({ id: seeded.id })).rejects.toThrow();
    await expectStillSent(seeded.id);
  });
});
