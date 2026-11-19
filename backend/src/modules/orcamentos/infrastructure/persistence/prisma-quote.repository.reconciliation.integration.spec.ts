import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import type { Quote } from '../../domain/entities/quote.js';
import { Curtain } from '../../domain/entities/curtain.js';
import { FinancialItem } from '../../domain/entities/financial-item.js';
import {
  QuoteHistoryDetails,
  type QuoteHistoryEventDraft,
} from '../../domain/history/quote-history.js';
import { PrismaQuoteRepository } from './prisma-quote.repository.js';
import { PrismaQuoteSequence } from './prisma-quote-sequence.js';

interface SeededIds {
  quoteId: string;
  curtainA: string;
  curtainB: string;
  componentA: string;
  componentB: string;
  addOnA: string;
}

// Exercises aggregate persistence and the unified financial collection
// reconciliation against the real PostgreSQL database.
describe('PrismaQuoteRepository integration — persistence', () => {
  const customerId = randomUUID();
  let prisma: PrismaService;
  let repository: PrismaQuoteRepository;

  function nextQuoteNumber(): string {
    // Reserved year; parallel integration specs use disjoint ranges.
    return `ORÇ-2003-${randomInt(100_000_000, 1_000_000_000)}`;
  }

  function editedEvent(): QuoteHistoryEventDraft {
    return {
      type: 'QUOTE_EDITED',
      details: QuoteHistoryDetails.edited([]),
    };
  }

  async function seedQuote(
    notes: string | null = 'Original',
  ): Promise<SeededIds> {
    const ids: SeededIds = {
      quoteId: randomUUID(),
      curtainA: randomUUID(),
      curtainB: randomUUID(),
      componentA: randomUUID(),
      componentB: randomUUID(),
      addOnA: randomUUID(),
    };

    await prisma.quote.create({
      data: {
        id: ids.quoteId,
        quoteNumber: nextQuoteNumber(),
        customerId,
        status: 'DRAFT',
        notes,
        curtains: {
          create: [
            { id: ids.curtainA, sequence: 1, room: 'Sala' },
            { id: ids.curtainB, sequence: 2, room: 'Quarto' },
          ],
        },
        financialItems: {
          create: [
            {
              id: ids.componentA,
              curtainId: ids.curtainA,
              name: 'Tecido',
              quantity: '2.000000',
              unitPriceCents: 1_000,
            },
            {
              id: ids.componentB,
              curtainId: ids.curtainA,
              name: 'Mão de obra',
              quantity: '1.000000',
              unitPriceCents: 2_000,
            },
            {
              id: ids.addOnA,
              name: 'Frete',
              quantity: '1.000000',
              unitPriceCents: 5_000,
            },
          ],
        },
      },
    });

    return ids;
  }

  async function loadQuote(id: string): Promise<Quote> {
    const quote = await repository.findById(id);

    if (quote === null) {
      throw new Error('Quote not found in test');
    }

    return quote;
  }

  function readQuote(quoteId: string) {
    return Promise.all([
      prisma.quote.findUniqueOrThrow({ where: { id: quoteId } }),
      prisma.curtain.findMany({
        where: { quoteId },
        orderBy: { sequence: 'asc' },
      }),
      prisma.financialItem.findMany({ where: { quoteId } }),
    ]);
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
        name: `Quote Persistence ${randomUUID()}`,
        phone: '11999999999',
      },
    });
  });

  afterAll(async () => {
    await prisma.quote.deleteMany({ where: { customerId } });
    await prisma.customer.delete({ where: { id: customerId } });
    await prisma.$disconnect();
  });

  it('updates children preserving their ids', async () => {
    const ids = await seedQuote();
    const quote = await loadQuote(ids.quoteId);

    quote.applyPatch({
      notes: 'Atualizado',
      curtains: [
        { id: ids.curtainA, room: 'Sala de Estar' },
        { id: ids.curtainB },
      ],
      financialItems: [
        { id: ids.componentA, name: 'Tecido premium' },
        { id: ids.componentB },
        { id: ids.addOnA, name: 'Frete expresso' },
      ],
    });
    await repository.save(quote, editedEvent());

    const [row, curtains, items] = await readQuote(ids.quoteId);

    expect(row.notes).toBe('Atualizado');
    expect(curtains.map((curtain) => curtain.id)).toEqual([
      ids.curtainA,
      ids.curtainB,
    ]);
    expect(curtains[0].room).toBe('Sala de Estar');
    expect(items.map((item) => item.id).sort()).toEqual(
      [ids.componentA, ids.componentB, ids.addOnA].sort(),
    );
    expect(items.find((item) => item.id === ids.componentA)?.name).toBe(
      'Tecido premium',
    );
    expect(items.find((item) => item.id === ids.addOnA)?.name).toBe(
      'Frete expresso',
    );
  });

  it('reorders curtains, recalculating sequences', async () => {
    const ids = await seedQuote();
    const quote = await loadQuote(ids.quoteId);

    quote.applyPatch({
      curtains: [{ id: ids.curtainB }, { id: ids.curtainA }],
    });
    await repository.save(quote, editedEvent());

    const [, curtains, items] = await readQuote(ids.quoteId);

    expect(curtains.map((curtain) => curtain.id)).toEqual([
      ids.curtainB,
      ids.curtainA,
    ]);
    expect(curtains.map((curtain) => curtain.sequence)).toEqual([1, 2]);
    expect(items).toHaveLength(3);
  });

  it('creates new curtains and financial items in separate saves', async () => {
    const ids = await seedQuote();
    const quote = await loadQuote(ids.quoteId);

    quote.applyPatch({
      curtains: [
        { id: ids.curtainA },
        { id: ids.curtainB },
        { room: 'Cozinha' },
      ],
    });
    await repository.save(quote, editedEvent());

    const withNewCurtain = await loadQuote(ids.quoteId);
    const newCurtain = withNewCurtain.curtains.find(
      (curtain) => curtain.room === 'Cozinha',
    );

    if (newCurtain === undefined) {
      throw new Error('New curtain was not persisted');
    }

    withNewCurtain.applyPatch({
      financialItems: [
        { id: ids.componentA },
        { id: ids.componentB },
        { id: ids.addOnA },
        {
          name: 'Tecido',
          curtainId: newCurtain.id,
          quantity: 3,
          unitPriceCents: 700,
        },
        { name: 'Instalação', quantity: 1, unitPriceCents: 2_500 },
      ],
    });
    await repository.save(withNewCurtain, editedEvent());

    const [, curtains, items] = await readQuote(ids.quoteId);
    const newCurtainId = curtains[2].id;
    const newItems = items.filter((item) => item.curtainId === newCurtainId);

    expect(curtains).toHaveLength(3);
    expect(curtains[2].room).toBe('Cozinha');
    expect(curtains[2].sequence).toBe(3);
    expect(newItems).toHaveLength(1);
    expect(newItems[0].id).not.toBe(ids.componentA);
    expect(newItems[0].unitPriceCents).toBe(700);
    expect(
      items.filter((item) => item.curtainId === null).map((item) => item.name),
    ).toEqual(expect.arrayContaining(['Frete', 'Instalação']));
  });

  it('moves an item between curtains and the general composition preserving its id', async () => {
    const ids = await seedQuote();
    const quote = await loadQuote(ids.quoteId);

    quote.applyPatch({
      financialItems: [
        { id: ids.componentA, curtainId: ids.curtainB },
        { id: ids.componentB },
        { id: ids.addOnA },
      ],
    });
    await repository.save(quote, editedEvent());

    const movedBetweenCurtains = await prisma.financialItem.findUniqueOrThrow({
      where: { id: ids.componentA },
    });

    expect(movedBetweenCurtains.curtainId).toBe(ids.curtainB);

    const reloaded = await loadQuote(ids.quoteId);

    reloaded.applyPatch({
      financialItems: [
        { id: ids.componentA, curtainId: null },
        { id: ids.componentB },
        { id: ids.addOnA },
      ],
    });
    await repository.save(reloaded, editedEvent());

    const movedToGeneral = await prisma.financialItem.findUniqueOrThrow({
      where: { id: ids.componentA },
    });

    expect(movedToGeneral.curtainId).toBeNull();
    expect(movedToGeneral.name).toBe('Tecido');
  });

  it('recomputes the same totals after saving and reloading', async () => {
    const ids = await seedQuote();
    const quote = await loadQuote(ids.quoteId);

    expect(quote.totalCents).toBe(9_000);

    quote.applyPatch({
      financialItems: [
        { id: ids.componentA, curtainId: null },
        { id: ids.componentB },
        { id: ids.addOnA },
      ],
    });
    await repository.save(quote, editedEvent());

    const reloaded = await loadQuote(ids.quoteId);

    expect(reloaded.curtainsSubtotalCents).toBe(2_000);
    expect(reloaded.generalAddOnsSubtotalCents).toBe(7_000);
    expect(reloaded.totalCents).toBe(9_000);
    expect(reloaded.generalFinancialItems.map((item) => item.id)).toEqual(
      expect.arrayContaining([ids.componentA, ids.addOnA]),
    );
  });

  it('removes children absent from a sent collection', async () => {
    const ids = await seedQuote();
    const quote = await loadQuote(ids.quoteId);

    quote.applyPatch({
      curtains: [{ id: ids.curtainA }],
      financialItems: [{ id: ids.componentA }],
    });
    await repository.save(quote, editedEvent());

    const [, curtains, items] = await readQuote(ids.quoteId);

    expect(curtains).toHaveLength(1);
    expect(curtains[0].id).toBe(ids.curtainA);
    expect(items.map((item) => item.id)).toEqual([ids.componentA]);
  });

  it('preserves omitted collections', async () => {
    const ids = await seedQuote();
    const quote = await loadQuote(ids.quoteId);

    quote.applyPatch({ notes: 'Somente escalares' });
    await repository.save(quote, editedEvent());

    const [row, curtains, items] = await readQuote(ids.quoteId);

    expect(row.notes).toBe('Somente escalares');
    expect(curtains.map((curtain) => curtain.id)).toEqual([
      ids.curtainA,
      ids.curtainB,
    ]);
    expect(items).toHaveLength(3);
  });

  it('removes every child when empty collections are sent', async () => {
    const ids = await seedQuote();
    const quote = await loadQuote(ids.quoteId);

    quote.applyPatch({ curtains: [], financialItems: [] });
    await repository.save(quote, editedEvent());

    const [, curtains, items] = await readQuote(ids.quoteId);

    expect(curtains).toEqual([]);
    expect(items).toEqual([]);
  });

  it('rejects a foreign curtain id and rolls the whole operation back', async () => {
    const ids = await seedQuote();
    const foreign = await seedQuote('Outro orçamento');
    const quote = await loadQuote(ids.quoteId);

    quote.applyPatch({ notes: 'Não deve persistir' });
    quote.curtains.push(
      Curtain.rehydrate({
        id: foreign.curtainA,
        sequence: 99,
        room: 'Estrangeira',
        description: null,
        material: null,
        openingWidth: null,
        borderValue: null,
        height: null,
        fabricFactor: null,
        notes: null,
      }),
    );

    await expect(repository.save(quote, editedEvent())).rejects.toBeDefined();

    const [row, curtains, items] = await readQuote(ids.quoteId);

    expect(row.notes).toBe('Original');
    expect(curtains.map((curtain) => curtain.id)).toEqual([
      ids.curtainA,
      ids.curtainB,
    ]);
    expect(curtains.map((curtain) => curtain.sequence)).toEqual([1, 2]);
    expect(items).toHaveLength(3);
    // The other quote is untouched.
    const foreignCurtains = await prisma.curtain.findMany({
      where: { quoteId: foreign.quoteId },
    });

    expect(foreignCurtains).toHaveLength(2);
  });

  it('rejects an item association to another quote and rolls the whole operation back', async () => {
    const ids = await seedQuote();
    const foreign = await seedQuote('Outro orçamento');
    const quote = await loadQuote(ids.quoteId);

    quote.applyPatch({ notes: 'Não deve persistir' });
    quote.financialItems.push(
      FinancialItem.rehydrate({
        id: foreign.componentA,
        quoteId: quote.id,
        curtainId: quote.curtains[0].id,
        name: 'Estrangeiro',
        quantity: 1,
        unit: null,
        unitPriceCents: 100,
      }),
    );

    await expect(repository.save(quote, editedEvent())).rejects.toBeDefined();

    const [row, , items] = await readQuote(ids.quoteId);

    expect(row.notes).toBe('Original');
    expect(items).toHaveLength(3);
    const foreignItems = await prisma.financialItem.findMany({
      where: { quoteId: foreign.quoteId },
    });

    expect(foreignItems).toHaveLength(3);
  });
});
