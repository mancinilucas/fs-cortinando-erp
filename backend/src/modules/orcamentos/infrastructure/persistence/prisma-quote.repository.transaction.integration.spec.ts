import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { Curtain } from '../../domain/entities/curtain.js';
import { FinancialItem } from '../../domain/entities/financial-item.js';
import { Quote } from '../../domain/entities/quote.js';
import {
  QuoteHistoryDetails,
  type QuoteHistoryEventDraft,
} from '../../domain/history/quote-history.js';
import type { QuoteCreation } from '../../domain/repositories/quote.repository.js';
import type { QuoteNumber } from '../../domain/value-objects/quote-number.js';
import { PrismaQuoteRepository } from './prisma-quote.repository.js';
import { PrismaQuoteSequence } from './prisma-quote-sequence.js';

// Exercises the transactional boundary of quote writes against the real
// PostgreSQL database (D108/D119).
describe('PrismaQuoteRepository integration — transactions', () => {
  const customerId = randomUUID();
  // Reserved years; parallel integration specs use disjoint ranges.
  const years = [1601, 1602, 1603];
  const createdAt = new Date('2026-10-19T12:00:00.000Z');
  let prisma: PrismaService;
  let repository: PrismaQuoteRepository;

  function buildQuote(quoteNumber: QuoteNumber): QuoteCreation {
    const curtain = Curtain.create({
      room: 'Sala',
      material: 'Linho',
      openingWidth: 2.6,
      height: 2.7,
      components: [
        FinancialItem.create({
          name: 'Tecido',
          quantity: 2,
          unitPriceCents: 1_000,
        }),
      ],
    });
    const quote = Quote.create({
      quoteNumber,
      customerId,
      createdAt,
      notes: 'Criado pelo teste',
      curtains: [curtain],
      generalAddOns: [
        FinancialItem.create({
          name: 'Frete',
          quantity: 1,
          unitPriceCents: 5_000,
        }),
      ],
    });

    return {
      quote,
      event: {
        type: 'QUOTE_CREATED',
        details: QuoteHistoryDetails.created(quoteNumber.value),
      },
    };
  }

  function editedEvent(): QuoteHistoryEventDraft {
    return {
      type: 'QUOTE_EDITED',
      details: QuoteHistoryDetails.edited([
        { field: 'notes', previous: 'Criado pelo teste', next: 'Editado' },
      ]),
    };
  }

  async function historyOf(quoteId: string) {
    return prisma.quoteHistory.findMany({ where: { quoteId } });
  }

  async function clearTestData(): Promise<void> {
    await prisma.quote.deleteMany({
      where: {
        OR: years.map((year) => ({
          quoteNumber: { startsWith: `ORÇ-${year}-` },
        })),
      },
    });
    await prisma.quoteSequence.deleteMany({ where: { year: { in: years } } });
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
        name: `Quote Transactions ${randomUUID()}`,
        phone: '11999999999',
      },
    });
    await clearTestData();
  });

  afterAll(async () => {
    await clearTestData();
    await prisma.customer.delete({ where: { id: customerId } });
    await prisma.$disconnect();
  });

  it('creates the aggregate, its children and exactly one event atomically', async () => {
    const quote = await repository.create(1601, buildQuote);

    const stored = await prisma.quote.findUnique({
      where: { id: quote.id },
      include: {
        curtains: { include: { components: true } },
        generalAddOns: true,
        history: true,
      },
    });
    const sequence = await prisma.quoteSequence.findUnique({
      where: { year: 1601 },
    });

    expect(stored?.quoteNumber).toBe('ORÇ-1601-001');
    expect(stored?.status).toBe('DRAFT');
    expect(stored?.curtains).toHaveLength(1);
    expect(stored?.curtains[0].components).toHaveLength(1);
    expect(stored?.generalAddOns).toHaveLength(1);
    expect(stored?.history).toHaveLength(1);
    expect(stored?.history[0].eventType).toBe('QUOTE_CREATED');
    expect(stored?.history[0].details).toEqual({
      quoteNumber: 'ORÇ-1601-001',
    });
    expect(sequence?.lastNumber).toBe(1);
  });

  it('rolls the reserved number back when the builder throws', async () => {
    await expect(
      repository.create(1602, () => {
        throw new Error('build failed');
      }),
    ).rejects.toThrow('build failed');

    expect(
      await prisma.quoteSequence.findUnique({ where: { year: 1602 } }),
    ).toBeNull();
    expect(
      await prisma.quote.count({
        where: { quoteNumber: { startsWith: 'ORÇ-1602-' } },
      }),
    ).toBe(0);
  });

  it('rolls the reserved number back when the aggregate insert fails', async () => {
    await expect(
      repository.create(1603, (quoteNumber) => {
        const creation = buildQuote(quoteNumber);
        // Duplicated id violates the child primary key during the insert.
        creation.quote.curtains.push(creation.quote.curtains[0]);

        return creation;
      }),
    ).rejects.toBeDefined();

    expect(
      await prisma.quoteSequence.findUnique({ where: { year: 1603 } }),
    ).toBeNull();
    expect(
      await prisma.quote.count({
        where: { quoteNumber: { startsWith: 'ORÇ-1603-' } },
      }),
    ).toBe(0);
    expect(
      await prisma.quoteHistory.count({
        where: { quote: { quoteNumber: { startsWith: 'ORÇ-1603-' } } },
      }),
    ).toBe(0);
  });

  it('appends exactly one event when saving a mutation', async () => {
    const quote = await repository.create(1601, buildQuote);

    quote.applyPatch({ notes: 'Editado' });
    await repository.save(quote, editedEvent());

    const history = await historyOf(quote.id);
    const edited = history.find((event) => event.eventType === 'QUOTE_EDITED');

    expect(history).toHaveLength(2);
    expect(edited?.details).toEqual({
      changes: [
        { field: 'notes', previous: 'Criado pelo teste', next: 'Editado' },
      ],
    });
  });

  it('mutates the aggregate loaded inside the transaction', async () => {
    const quote = await repository.create(1601, buildQuote);

    const mutated = await repository.mutate(quote.id, (quote) => {
      quote.applyPatch({ notes: 'Mutado' });

      return editedEvent();
    });

    expect(mutated).not.toBeNull();
    expect(mutated?.notes).toBe('Mutado');

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: quote.id },
    });

    expect(stored.notes).toBe('Mutado');
    expect(await historyOf(quote.id)).toHaveLength(2);
  });

  it('returns null when the quote does not exist', async () => {
    await expect(
      repository.mutate(randomUUID(), () => null),
    ).resolves.toBeNull();
  });

  it('does not persist when the operation reports no change', async () => {
    const quote = await repository.create(1601, buildQuote);

    const mutated = await repository.mutate(quote.id, (quote) => {
      quote.applyPatch({ notes: 'Não deve persistir' });

      return null;
    });

    expect(mutated?.notes).toBe('Não deve persistir');

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: quote.id },
    });

    expect(stored.notes).toBe('Criado pelo teste');
    expect(await historyOf(quote.id)).toHaveLength(1);
  });

  it('rolls back state and history when the operation throws', async () => {
    const quote = await repository.create(1601, buildQuote);

    await expect(
      repository.mutate(quote.id, (quote) => {
        quote.applyPatch({ notes: 'Não deve persistir' });

        throw new Error('operation failed');
      }),
    ).rejects.toThrow('operation failed');

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: quote.id },
    });

    expect(stored.notes).toBe('Criado pelo teste');
    expect(await historyOf(quote.id)).toHaveLength(1);
  });

  it('does not change state or history when the history insert fails', async () => {
    const quote = await repository.create(1601, buildQuote);

    quote.applyPatch({ notes: 'Não deve persistir' });

    // A circular payload cannot be serialized into the JSON column, which
    // forces the history insert to fail after the aggregate update already ran.
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const failingEvent = {
      type: 'QUOTE_EDITED',
      details: { changes: [], circular },
    } as unknown as QuoteHistoryEventDraft;

    await expect(repository.save(quote, failingEvent)).rejects.toBeDefined();

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: quote.id },
    });

    expect(stored.notes).toBe('Criado pelo teste');
    expect(await historyOf(quote.id)).toHaveLength(1);
  });

  it('does not write history when the aggregate update fails', async () => {
    const quote = await repository.create(1601, buildQuote);
    const other = await repository.create(1601, buildQuote);

    quote.applyPatch({ notes: 'Não deve persistir' });
    quote.curtains[0].components.push(
      FinancialItem.rehydrate({
        id: other.curtains[0].components[0].id,
        name: 'Estrangeiro',
        quantity: 1,
        unit: null,
        unitPriceCents: 100,
      }),
    );

    await expect(repository.save(quote, editedEvent())).rejects.toBeDefined();

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: quote.id },
    });

    expect(stored.notes).toBe('Criado pelo teste');
    expect(await historyOf(quote.id)).toHaveLength(1);
  });
});
