import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import {
  QuoteNotEditableError,
  QuoteValidationError,
  UnknownQuoteItemError,
} from '../../domain/errors/quote-domain.errors.js';
import { PrismaQuoteRepository } from '../../infrastructure/persistence/prisma-quote.repository.js';
import { PrismaQuoteSequence } from '../../infrastructure/persistence/prisma-quote-sequence.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { UpdateQuoteUseCase } from './update-quote.use-case.js';

interface SeededQuote {
  id: string;
  curtainId: string;
  componentId: string;
  addOnId: string;
}

// Exercises the update use case against the real PostgreSQL database.
describe('UpdateQuoteUseCase integration', () => {
  // Reserved year band; parallel integration specs use disjoint ranges.
  const year = randomInt(2_100, 2_199);
  const customerId = randomUUID();
  let prisma: PrismaService;
  let useCase: UpdateQuoteUseCase;
  let quoteCounter = 0;

  function nextQuoteNumber(): string {
    quoteCounter += 1;

    return `ORÇ-${year}-${String(quoteCounter).padStart(3, '0')}`;
  }

  async function seedQuote(
    input: {
      status?: 'DRAFT' | 'SENT' | 'CONFIRMED';
      notes?: string | null;
      firstSentAt?: Date | null;
      validUntil?: Date | null;
      withAddress?: boolean;
    } = {},
  ): Promise<SeededQuote> {
    const seeded: SeededQuote = {
      id: randomUUID(),
      curtainId: randomUUID(),
      componentId: randomUUID(),
      addOnId: randomUUID(),
    };
    const withAddress = input.withAddress ?? true;

    await prisma.quote.create({
      data: {
        id: seeded.id,
        quoteNumber: nextQuoteNumber(),
        customerId,
        status: input.status ?? 'DRAFT',
        notes: input.notes ?? null,
        firstSentAt: input.firstSentAt ?? null,
        validUntil: input.validUntil ?? null,
        installationAddressPostalCode: withAddress ? '01310100' : null,
        installationAddressStreet: withAddress ? 'Avenida Paulista' : null,
        installationAddressNumber: withAddress ? '1000' : null,
        installationAddressNeighborhood: withAddress ? 'Bela Vista' : null,
        installationAddressCity: withAddress ? 'São Paulo' : null,
        installationAddressState: withAddress ? 'SP' : null,
        curtains: {
          create: {
            id: seeded.curtainId,
            sequence: 1,
            room: 'Sala',
            material: 'Linho A',
            openingWidth: 2.6,
            borderValue: 0.15,
            height: 2.6,
            fabricFactor: 3.5,
          },
        },
        financialItems: {
          create: [
            {
              id: seeded.componentId,
              curtainId: seeded.curtainId,
              name: 'Tecido',
              quantity: 8.05,
              unit: 'm',
              unitPriceCents: 3_000,
            },
            {
              id: seeded.addOnId,
              name: 'Frete',
              quantity: 1,
              unitPriceCents: 5_000,
            },
          ],
        },
      },
    });

    return seeded;
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
    useCase = new UpdateQuoteUseCase(
      new PrismaQuoteRepository(prisma, new PrismaQuoteSequence(prisma)),
    );

    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Quote Update ${randomUUID()}`,
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
      useCase.execute({ id: randomUUID(), notes: 'Novo' }),
    ).rejects.toBeInstanceOf(QuoteNotFoundError);
  });

  it('edits only the informed scalar and records one QUOTE_EDITED', async () => {
    const seeded = await seedQuote({ notes: 'Original' });

    const quote = await useCase.execute({
      id: seeded.id,
      notes: '  Instalação urgente  ',
    });

    expect(quote.notes).toBe('Instalação urgente');

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });
    const history = await historyOf(seeded.id);

    expect(stored.notes).toBe('Instalação urgente');
    expect(history).toHaveLength(1);
    expect(history[0].eventType).toBe('QUOTE_EDITED');
    expect(history[0].details).toEqual({
      changes: [
        { field: 'notes', previous: 'Original', next: 'Instalação urgente' },
      ],
    });

    const children = await prisma.curtain.findMany({
      where: { quoteId: seeded.id },
    });
    const items = await prisma.financialItem.findMany({
      where: { quoteId: seeded.id },
      orderBy: { name: 'asc' },
    });

    expect(children).toHaveLength(1);
    expect(children[0].id).toBe(seeded.curtainId);
    expect(items.map((item) => item.id).sort()).toEqual(
      [seeded.componentId, seeded.addOnId].sort(),
    );
  });

  it('edits only the commercial adjustment when it is the only field', async () => {
    const seeded = await seedQuote();

    await useCase.execute({ id: seeded.id, commercialAdjustmentCents: -500 });

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });
    const history = await historyOf(seeded.id);

    expect(stored.commercialAdjustmentCents).toBe(-500);
    expect(history).toHaveLength(1);
    expect(history[0].details).toEqual({
      changes: [
        {
          field: 'commercialAdjustmentCents',
          previous: null,
          next: -500,
        },
      ],
    });
  });

  it('replaces the installation address when a partial object is sent', async () => {
    const seeded = await seedQuote();

    await useCase.execute({
      id: seeded.id,
      installationAddress: { street: 'Rua Nova' },
    });

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });
    const history = await historyOf(seeded.id);

    expect(stored).toMatchObject({
      installationAddressPostalCode: null,
      installationAddressStreet: 'Rua Nova',
      installationAddressNumber: null,
      installationAddressNeighborhood: null,
      installationAddressCity: null,
      installationAddressState: null,
    });
    expect(history).toHaveLength(1);
    expect(history[0].details).toEqual({
      changes: [
        {
          field: 'installationAddress.postalCode',
          previous: '01310100',
          next: null,
        },
        {
          field: 'installationAddress.street',
          previous: 'Avenida Paulista',
          next: 'Rua Nova',
        },
        {
          field: 'installationAddress.number',
          previous: '1000',
          next: null,
        },
        {
          field: 'installationAddress.neighborhood',
          previous: 'Bela Vista',
          next: null,
        },
        {
          field: 'installationAddress.city',
          previous: 'São Paulo',
          next: null,
        },
        {
          field: 'installationAddress.state',
          previous: 'SP',
          next: null,
        },
      ],
    });
  });

  it('reconciles curtains and the financial collection by id', async () => {
    const seeded = await seedQuote();

    const quote = await useCase.execute({
      id: seeded.id,
      curtains: [
        { id: seeded.curtainId, height: 2.65 },
        {
          room: 'Quarto',
          material: 'Voil',
          openingWidth: 1.5,
          height: 2,
        },
      ],
      financialItems: [
        { id: seeded.componentId, name: 'Linho B' },
        {
          name: 'Mão de obra',
          curtainId: seeded.curtainId,
          quantity: 1,
          unitPriceCents: 20_000,
        },
        { id: seeded.addOnId, quantity: 2 },
      ],
    });

    expect(quote.curtains).toHaveLength(2);
    expect(
      quote.financialItemsForCurtain(seeded.curtainId).map((item) => item.name),
    ).toContain('Mão de obra');

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
      include: {
        curtains: { orderBy: { sequence: 'asc' } },
        financialItems: true,
      },
    });
    const history = await historyOf(seeded.id);
    const salaItems = stored.financialItems.filter(
      (item) => item.curtainId === seeded.curtainId,
    );

    expect(stored.curtains).toHaveLength(2);
    expect(stored.curtains[0].id).toBe(seeded.curtainId);
    expect(Number(stored.curtains[0].height)).toBe(2.65);
    expect(salaItems.map((item) => item.id)).toContain(seeded.componentId);
    expect(salaItems.map((item) => item.name).sort()).toEqual(
      ['Linho B', 'Mão de obra'].sort(),
    );
    expect(stored.curtains[1].sequence).toBe(2);
    expect(stored.curtains[1].room).toBe('Quarto');
    expect(
      stored.financialItems.filter((item) => item.curtainId === null),
    ).toHaveLength(1);
    expect(
      Number(
        stored.financialItems.find((item) => item.id === seeded.addOnId)
          ?.quantity,
      ),
    ).toBe(2);

    expect(history).toHaveLength(1);
    expect(history[0].eventType).toBe('QUOTE_EDITED');
    expect(history[0].details).toEqual({
      changes: [
        {
          field: 'height',
          previous: 2.6,
          next: 2.65,
          curtainSequence: 1,
          curtainRoom: 'Sala',
        },
        {
          field: 'name',
          previous: 'Tecido',
          next: 'Linho B',
          curtainSequence: 1,
          curtainRoom: 'Sala',
          componentName: 'Linho B',
        },
        {
          field: 'component',
          previous: null,
          next: 'Mão de obra',
          curtainSequence: 1,
          curtainRoom: 'Sala',
          componentName: 'Mão de obra',
        },
        {
          field: 'curtain',
          previous: null,
          next: 'Quarto',
          curtainSequence: 2,
          curtainRoom: 'Quarto',
        },
        {
          field: 'quantity',
          previous: 1,
          next: 2,
        },
      ],
    });
  });

  it('adds the fabric item from a new curtain price in the same patch', async () => {
    const seeded = await seedQuote();

    const quote = await useCase.execute({
      id: seeded.id,
      curtains: [
        { id: seeded.curtainId },
        {
          clientRef: 'quarto',
          room: 'Quarto',
          material: 'Voil',
          openingWidth: 2,
          height: 2.4,
          fabricUnitPriceCents: 9_900,
        },
      ],
      financialItems: [{ id: seeded.componentId }, { id: seeded.addOnId }],
    });

    const added = quote.curtains.find((curtain) => curtain.room === 'Quarto');
    expect(added).toBeDefined();

    const items = quote.financialItemsForCurtain(added!.id);
    const [fabric] = items;

    expect(items).toHaveLength(1);
    expect(fabric).toMatchObject({
      name: 'Tecido',
      unit: 'm',
      unitPriceCents: 9_900,
    });
    expect(fabric.quantity).toBe(added!.fabricQuantity);

    const stored = await prisma.financialItem.findMany({
      where: { quoteId: seeded.id },
    });

    expect(stored.filter((item) => item.curtainId === added!.id)).toHaveLength(
      1,
    );
    expect(stored.find((item) => item.id === seeded.componentId)).toBeDefined();
    expect(stored.find((item) => item.id === seeded.addOnId)).toBeDefined();
  });

  it('rejects a fabric price on an existing curtain', async () => {
    const seeded = await seedQuote();

    await expect(
      useCase.execute({
        id: seeded.id,
        curtains: [{ id: seeded.curtainId, fabricUnitPriceCents: 1_000 }],
        financialItems: [],
      }),
    ).rejects.toBeInstanceOf(UnknownQuoteItemError);
  });

  it('requires the complete financial collection when adding a fabric price', async () => {
    const seeded = await seedQuote();

    await expect(
      useCase.execute({
        id: seeded.id,
        curtains: [
          {
            clientRef: 'quarto',
            room: 'Quarto',
            openingWidth: 2,
            fabricUnitPriceCents: 1_000,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnknownQuoteItemError);
  });

  it('rejects a fabric price without an opening width', async () => {
    const seeded = await seedQuote();

    await expect(
      useCase.execute({
        id: seeded.id,
        curtains: [
          {
            clientRef: 'quarto',
            room: 'Quarto',
            fabricUnitPriceCents: 1_000,
          },
        ],
        financialItems: [],
      }),
    ).rejects.toBeInstanceOf(QuoteValidationError);
  });

  it('moves an item to another curtain preserving its id', async () => {
    const seeded = await seedQuote();
    const otherCurtainId = randomUUID();

    await prisma.curtain.create({
      data: {
        id: otherCurtainId,
        quoteId: seeded.id,
        sequence: 2,
        room: 'Quarto',
      },
    });

    const quote = await useCase.execute({
      id: seeded.id,
      financialItems: [
        { id: seeded.componentId, curtainId: otherCurtainId },
        { id: seeded.addOnId },
      ],
    });

    expect(quote.financialItemsForCurtain(seeded.curtainId)).toEqual([]);
    expect(
      quote.financialItemsForCurtain(otherCurtainId).map((item) => item.id),
    ).toEqual([seeded.componentId]);
    expect(quote.generalFinancialItems.map((item) => item.id)).toEqual([
      seeded.addOnId,
    ]);

    const stored = await prisma.financialItem.findUniqueOrThrow({
      where: { id: seeded.componentId },
    });

    expect(stored.curtainId).toBe(otherCurtainId);
    expect(stored.quoteId).toBe(seeded.id);
  });

  it('moves an item between a curtain and the general composition', async () => {
    const seeded = await seedQuote();

    const general = await useCase.execute({
      id: seeded.id,
      financialItems: [
        { id: seeded.componentId, curtainId: null },
        { id: seeded.addOnId },
      ],
    });

    expect(general.generalFinancialItems.map((item) => item.id).sort()).toEqual(
      [seeded.componentId, seeded.addOnId].sort(),
    );

    const moved = await prisma.financialItem.findUniqueOrThrow({
      where: { id: seeded.componentId },
    });

    expect(moved.curtainId).toBeNull();

    const back = await useCase.execute({
      id: seeded.id,
      financialItems: [
        { id: seeded.componentId, curtainId: seeded.curtainId },
        { id: seeded.addOnId },
      ],
    });
    const restored = await prisma.financialItem.findUniqueOrThrow({
      where: { id: seeded.componentId },
    });

    expect(back.financialItemsForCurtain(seeded.curtainId)).toHaveLength(1);
    expect(restored.curtainId).toBe(seeded.curtainId);
  });

  it('does not save or write history when the patch changes nothing', async () => {
    const seeded = await seedQuote({ notes: 'Original' });

    const before = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });

    const quote = await useCase.execute({
      id: seeded.id,
      notes: '  Original  ',
      commercialAdjustmentCents: 0,
      installationAddress: {
        postalCode: '01310-100',
        street: 'Avenida Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'sp',
      },
      curtains: [
        {
          id: seeded.curtainId,
          room: 'Sala',
          material: 'Linho A',
          openingWidth: 2.6,
          borderValue: 0.15,
          height: 2.6,
          fabricFactor: 3.5,
        },
      ],
      financialItems: [
        {
          id: seeded.componentId,
          curtainId: seeded.curtainId,
          name: 'Tecido',
          quantity: 8.05,
          unit: 'm',
          unitPriceCents: 3_000,
        },
        {
          id: seeded.addOnId,
          name: 'Frete',
          quantity: 1,
          unitPriceCents: 5_000,
        },
      ],
    });

    const after = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });

    expect(quote.notes).toBe('Original');
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    expect(await historyOf(seeded.id)).toHaveLength(0);
  });

  it('removes omitted children when an empty collection is sent', async () => {
    const seeded = await seedQuote({ notes: 'Original' });

    await useCase.execute({
      id: seeded.id,
      curtains: [],
      financialItems: [],
    });

    expect(await prisma.curtain.count({ where: { quoteId: seeded.id } })).toBe(
      0,
    );
    expect(
      await prisma.financialItem.count({ where: { quoteId: seeded.id } }),
    ).toBe(0);

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });
    const history = await historyOf(seeded.id);

    expect(stored.notes).toBe('Original');
    expect(history).toHaveLength(1);
    expect(history[0].details).toEqual({
      changes: [
        {
          field: 'component',
          previous: 'Tecido',
          next: null,
          curtainSequence: 1,
          curtainRoom: 'Sala',
          componentName: 'Tecido',
        },
        {
          field: 'curtain',
          previous: 'Sala',
          next: null,
          curtainSequence: 1,
          curtainRoom: 'Sala',
        },
        { field: 'generalAddOn', previous: 'Frete', next: null },
      ],
    });
  });

  it('removes a curtain omitted from the sent collection and preserves the others', async () => {
    const seeded = await seedQuote();
    const otherCurtainId = randomUUID();

    await prisma.curtain.create({
      data: {
        id: otherCurtainId,
        quoteId: seeded.id,
        sequence: 2,
        room: 'Quarto',
      },
    });

    await useCase.execute({
      id: seeded.id,
      curtains: [{ id: seeded.curtainId, room: 'Sala' }],
    });

    const curtains = await prisma.curtain.findMany({
      where: { quoteId: seeded.id },
    });
    const items = await prisma.financialItem.findMany({
      where: { quoteId: seeded.id },
    });
    const history = await historyOf(seeded.id);

    expect(curtains).toHaveLength(1);
    expect(curtains[0].id).toBe(seeded.curtainId);
    expect(items.map((item) => item.id)).toContain(seeded.componentId);
    expect(history).toHaveLength(1);
    expect(history[0].details).toEqual({
      changes: [
        {
          field: 'curtain',
          previous: 'Quarto',
          next: null,
          curtainSequence: 2,
          curtainRoom: 'Quarto',
        },
      ],
    });
  });

  it('reorders curtains and persists the recalculated sequence', async () => {
    const seeded = await seedQuote();
    const secondCurtainId = randomUUID();

    await prisma.curtain.create({
      data: {
        id: secondCurtainId,
        quoteId: seeded.id,
        sequence: 2,
        room: 'Quarto',
      },
    });

    await useCase.execute({
      id: seeded.id,
      curtains: [{ id: secondCurtainId }, { id: seeded.curtainId }],
    });

    const curtains = await prisma.curtain.findMany({
      where: { quoteId: seeded.id },
      orderBy: { sequence: 'asc' },
    });
    const items = await prisma.financialItem.findMany({
      where: { quoteId: seeded.id },
    });
    const history = await historyOf(seeded.id);

    expect(curtains.map((curtain) => curtain.id)).toEqual([
      secondCurtainId,
      seeded.curtainId,
    ]);
    expect(curtains.map((curtain) => curtain.sequence)).toEqual([1, 2]);
    expect(items.map((item) => item.id)).toContain(seeded.componentId);
    expect(history).toHaveLength(1);
    expect(history[0].details).toEqual({
      changes: [
        {
          field: 'sequence',
          previous: 2,
          next: 1,
          curtainSequence: 1,
          curtainRoom: 'Quarto',
        },
        {
          field: 'sequence',
          previous: 1,
          next: 2,
          curtainSequence: 2,
          curtainRoom: 'Sala',
        },
      ],
    });
  });

  it('rejects unknown and foreign child ids without persisting anything', async () => {
    const seeded = await seedQuote({ notes: 'Original' });
    const other = await seedQuote();

    await expect(
      useCase.execute({
        id: seeded.id,
        curtains: [{ id: randomUUID(), room: 'Sala' }],
      }),
    ).rejects.toBeInstanceOf(UnknownQuoteItemError);

    await expect(
      useCase.execute({
        id: seeded.id,
        financialItems: [
          { id: seeded.componentId, curtainId: randomUUID(), name: 'X' },
        ],
      }),
    ).rejects.toBeInstanceOf(UnknownQuoteItemError);

    await expect(
      useCase.execute({
        id: seeded.id,
        financialItems: [{ id: randomUUID(), name: 'X' }],
      }),
    ).rejects.toBeInstanceOf(UnknownQuoteItemError);

    await expect(
      useCase.execute({ id: seeded.id, curtains: [{ id: other.curtainId }] }),
    ).rejects.toBeInstanceOf(UnknownQuoteItemError);

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
      include: { curtains: true },
    });
    const items = await prisma.financialItem.findMany({
      where: { quoteId: seeded.id },
    });

    expect(stored.notes).toBe('Original');
    expect(stored.curtains).toHaveLength(1);
    expect(stored.curtains[0].id).toBe(seeded.curtainId);
    expect(items.map((item) => item.id)).toContain(seeded.componentId);
    expect(await historyOf(seeded.id)).toHaveLength(0);
  });

  it('rejects a quote whose status is not editable', async () => {
    const seeded = await seedQuote({ status: 'CONFIRMED', notes: 'Original' });

    await expect(
      useCase.execute({ id: seeded.id, notes: 'Novo' }),
    ).rejects.toBeInstanceOf(QuoteNotEditableError);

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });

    expect(stored.notes).toBe('Original');
    expect(await historyOf(seeded.id)).toHaveLength(0);
  });

  it('edits an expired SENT quote without touching its validity', async () => {
    const firstSentAt = new Date('2020-01-01T12:00:00.000Z');
    const validUntil = new Date('2020-01-31T12:00:00.000Z');
    const seeded = await seedQuote({
      status: 'SENT',
      notes: 'Original',
      firstSentAt,
      validUntil,
    });

    await useCase.execute({ id: seeded.id, notes: 'Renegociado' });

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });

    expect(stored.status).toBe('SENT');
    expect(stored.notes).toBe('Renegociado');
    expect(stored.firstSentAt?.toISOString()).toBe(firstSentAt.toISOString());
    expect(stored.validUntil?.toISOString()).toBe(validUntil.toISOString());
    expect(await historyOf(seeded.id)).toHaveLength(1);
  });
});
