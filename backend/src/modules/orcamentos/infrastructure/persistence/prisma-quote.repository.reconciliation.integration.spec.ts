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

// Exercises aggregate persistence and D117 reconciliation against the real
// PostgreSQL database.
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
            {
              id: ids.curtainA,
              sequence: 1,
              room: 'Sala',
              components: {
                create: [
                  {
                    id: ids.componentA,
                    name: 'Tecido',
                    quantity: '2.000000',
                    unitPriceCents: 1_000,
                  },
                  {
                    id: ids.componentB,
                    name: 'Mão de obra',
                    quantity: '1.000000',
                    unitPriceCents: 2_000,
                  },
                ],
              },
            },
            { id: ids.curtainB, sequence: 2, room: 'Quarto' },
          ],
        },
        generalAddOns: {
          create: [
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
        include: { components: true },
      }),
      prisma.generalAddOn.findMany({ where: { quoteId } }),
      prisma.financialComponent.count({
        where: { curtain: { quoteId } },
      }),
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
        {
          id: ids.curtainA,
          room: 'Sala de Estar',
          components: [
            { id: ids.componentA, name: 'Tecido premium' },
            { id: ids.componentB },
          ],
        },
        { id: ids.curtainB },
      ],
      generalAddOns: [{ id: ids.addOnA, name: 'Frete expresso' }],
    });
    await repository.save(quote, editedEvent());

    const [row, curtains, addOns] = await readQuote(ids.quoteId);

    expect(row.notes).toBe('Atualizado');
    expect(curtains.map((curtain) => curtain.id)).toEqual([
      ids.curtainA,
      ids.curtainB,
    ]);
    expect(curtains[0].room).toBe('Sala de Estar');
    expect(
      curtains[0].components.map((component) => component.id).sort(),
    ).toEqual([ids.componentA, ids.componentB].sort());
    expect(
      curtains[0].components.find(
        (component) => component.id === ids.componentA,
      )?.name,
    ).toBe('Tecido premium');
    expect(addOns.map((addOn) => addOn.id)).toEqual([ids.addOnA]);
    expect(addOns[0].name).toBe('Frete expresso');
  });

  it('reorders curtains, recalculating sequences', async () => {
    const ids = await seedQuote();
    const quote = await loadQuote(ids.quoteId);

    quote.applyPatch({
      curtains: [{ id: ids.curtainB }, { id: ids.curtainA }],
    });
    await repository.save(quote, editedEvent());

    const [, curtains, , componentCount] = await readQuote(ids.quoteId);

    expect(curtains.map((curtain) => curtain.id)).toEqual([
      ids.curtainB,
      ids.curtainA,
    ]);
    expect(curtains.map((curtain) => curtain.sequence)).toEqual([1, 2]);
    expect(curtains[1].components).toHaveLength(2);
    expect(componentCount).toBe(2);
  });

  it('creates new curtains, components and add-ons', async () => {
    const ids = await seedQuote();
    const quote = await loadQuote(ids.quoteId);

    quote.applyPatch({
      curtains: [
        {
          id: ids.curtainA,
          components: [{ id: ids.componentA }, { id: ids.componentB }],
        },
        { id: ids.curtainB },
        {
          room: 'Cozinha',
          components: [{ name: 'Tecido', quantity: 3, unitPriceCents: 700 }],
        },
      ],
      generalAddOns: [
        { id: ids.addOnA },
        { name: 'Instalação', quantity: 1, unitPriceCents: 2_500 },
      ],
    });
    await repository.save(quote, editedEvent());

    const [, curtains, addOns] = await readQuote(ids.quoteId);

    expect(curtains).toHaveLength(3);
    expect(curtains[2].id).not.toBe(ids.curtainA);
    expect(curtains[2].id).not.toBe(ids.curtainB);
    expect(curtains[2].sequence).toBe(3);
    expect(curtains[2].room).toBe('Cozinha');
    expect(curtains[2].components).toHaveLength(1);
    expect(curtains[2].components[0].id).not.toBe(ids.componentA);
    expect(curtains[2].components[0].unitPriceCents).toBe(700);

    expect(addOns).toHaveLength(2);
    expect(addOns.map((addOn) => addOn.id)).toContain(ids.addOnA);
    expect(addOns.map((addOn) => addOn.name)).toContain('Instalação');
  });

  it('removes children absent from a sent collection', async () => {
    const ids = await seedQuote();
    const quote = await loadQuote(ids.quoteId);

    quote.applyPatch({
      curtains: [{ id: ids.curtainA, components: [{ id: ids.componentA }] }],
    });
    await repository.save(quote, editedEvent());

    const [, curtains, addOns, componentCount] = await readQuote(ids.quoteId);

    expect(curtains).toHaveLength(1);
    expect(curtains[0].id).toBe(ids.curtainA);
    expect(curtains[0].components.map((component) => component.id)).toEqual([
      ids.componentA,
    ]);
    expect(componentCount).toBe(1);
    // generalAddOns was omitted, so the existing add-on is preserved.
    expect(addOns.map((addOn) => addOn.id)).toEqual([ids.addOnA]);
  });

  it('preserves omitted collections', async () => {
    const ids = await seedQuote();
    const quote = await loadQuote(ids.quoteId);

    quote.applyPatch({ notes: 'Somente escalares' });
    await repository.save(quote, editedEvent());

    const [row, curtains, addOns, componentCount] = await readQuote(
      ids.quoteId,
    );

    expect(row.notes).toBe('Somente escalares');
    expect(curtains.map((curtain) => curtain.id)).toEqual([
      ids.curtainA,
      ids.curtainB,
    ]);
    expect(addOns.map((addOn) => addOn.id)).toEqual([ids.addOnA]);
    expect(componentCount).toBe(2);
  });

  it('removes every child when empty collections are sent', async () => {
    const ids = await seedQuote();
    const quote = await loadQuote(ids.quoteId);

    quote.applyPatch({ curtains: [], generalAddOns: [] });
    await repository.save(quote, editedEvent());

    const [, curtains, addOns, componentCount] = await readQuote(ids.quoteId);

    expect(curtains).toEqual([]);
    expect(addOns).toEqual([]);
    expect(componentCount).toBe(0);
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
        components: [],
      }),
    );

    await expect(repository.save(quote, editedEvent())).rejects.toBeDefined();

    const [row, curtains, , componentCount] = await readQuote(ids.quoteId);

    expect(row.notes).toBe('Original');
    expect(curtains.map((curtain) => curtain.id)).toEqual([
      ids.curtainA,
      ids.curtainB,
    ]);
    expect(curtains.map((curtain) => curtain.sequence)).toEqual([1, 2]);
    expect(componentCount).toBe(2);
    // The other quote is untouched.
    const foreignCurtains = await prisma.curtain.findMany({
      where: { quoteId: foreign.quoteId },
    });

    expect(foreignCurtains).toHaveLength(2);
  });

  it('rejects a foreign component id and rolls the whole operation back', async () => {
    const ids = await seedQuote();
    const foreign = await seedQuote('Outro orçamento');
    const quote = await loadQuote(ids.quoteId);

    quote.applyPatch({ notes: 'Não deve persistir' });
    quote.curtains[0].components.push(
      FinancialItem.rehydrate({
        id: foreign.componentA,
        name: 'Estrangeiro',
        quantity: 1,
        unit: null,
        unitPriceCents: 100,
      }),
    );

    await expect(repository.save(quote, editedEvent())).rejects.toBeDefined();

    const [row, curtains, , componentCount] = await readQuote(ids.quoteId);

    expect(row.notes).toBe('Original');
    expect(curtains[0].components).toHaveLength(2);
    expect(componentCount).toBe(2);
  });
});
