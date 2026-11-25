import { describe, expect, it } from 'vitest';
import { Curtain } from './curtain.js';
import { FinancialItem } from './financial-item.js';
import { Quote, QuoteStatus } from './quote.js';
import {
  QuoteNotEditableError,
  QuoteValidationError,
  UnknownQuoteItemError,
} from '../errors/quote-domain.errors.js';
import { Discount } from '../value-objects/discount.js';
import { InstallationAddress } from '../value-objects/installation-address.js';
import { QuoteNumber } from '../value-objects/quote-number.js';

const createdAt = new Date('2026-10-19T12:00:00.000Z');

function quoteWith(
  curtains: Curtain[] = [],
  financialItems: FinancialItem[] = [],
): Quote {
  const base = Quote.create({
    quoteNumber: QuoteNumber.create(2026, 42),
    customerId: '6f2b9f2c-3b8c-4e4a-9f2e-1a2b3c4d5e6f',
    createdAt,
    curtains,
  });
  return Quote.rehydrate({
    id: base.id,
    quoteNumber: base.quoteNumber,
    customerId: base.customerId,
    status: base.status,
    installationAddress: InstallationAddress.create({
      street: 'Avenida Paulista',
      number: '1000',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
    }),
    curtains,
    financialItems: financialItems.map((item) =>
      FinancialItem.rehydrate({
        id: item.id,
        quoteId: base.id,
        curtainId: item.curtainId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        unitPriceCents: item.unitPriceCents,
      }),
    ),
    discount: Discount.noDiscount(),
    commercialAdjustmentCents: null,
    notes: null,
    createdAt,
    updatedAt: createdAt,
    firstSentAt: null,
    validUntil: null,
    confirmedAt: null,
    productionStartedAt: null,
    scheduledInstallationAt: null,
    completedAt: null,
  });
}

function item(
  name: string,
  curtainId: string | null,
  quantity = 1,
  unitPriceCents = 1_000,
): FinancialItem {
  return FinancialItem.create(
    { name, curtainId, quantity, unitPriceCents },
    'initial-owner',
  );
}

function quoteWithStatus(status: QuoteStatus): Quote {
  const curtain = Curtain.create({
    room: 'Sala',
    material: 'Linho',
    openingWidth: 2,
    height: 2.5,
  });
  const original = item('Tecido', curtain.id);
  const draft = quoteWith([curtain], [original]);
  return Quote.rehydrate({
    id: draft.id,
    quoteNumber: draft.quoteNumber,
    customerId: draft.customerId,
    status,
    installationAddress: draft.installationAddress,
    curtains: draft.curtains,
    financialItems: draft.financialItems,
    discount: draft.discount,
    commercialAdjustmentCents: draft.commercialAdjustmentCents,
    notes: draft.notes,
    createdAt,
    updatedAt: createdAt,
    firstSentAt: status === QuoteStatus.SENT ? createdAt : null,
    validUntil:
      status === QuoteStatus.SENT ? new Date('2026-11-19T12:00:00.000Z') : null,
    confirmedAt: null,
    productionStartedAt: null,
    scheduledInstallationAt: null,
    completedAt: null,
  });
}

describe('Quote.applyPatch unified financial items', () => {
  it('preserves items when financialItems is omitted', () => {
    const curtain = Curtain.create({ room: 'Sala' });
    const financialItem = item('Tecido', curtain.id);
    const quote = quoteWith([curtain], [financialItem]);
    const collection = quote.financialItems;

    quote.applyPatch({ notes: 'Atualização parcial' });

    expect(quote.financialItems).toBe(collection);
    expect(quote.financialItems[0].id).toBe(financialItem.id);
  });

  it('removes every item when an empty collection is sent in DRAFT', () => {
    const curtain = Curtain.create({ room: 'Sala' });
    const quote = quoteWith(
      [curtain],
      [item('Tecido', curtain.id), item('Frete', null)],
    );

    quote.applyPatch({ financialItems: [] });

    expect(quote.financialItems).toEqual([]);
    expect(quote.curtains).toHaveLength(1);
    expect(quote.subtotalCents).toBe(0);
  });

  it('reconciles a sent collection and preserves existing entity identity', () => {
    const curtain = Curtain.create({ room: 'Sala' });
    const quote = quoteWith([curtain], [item('Tecido', curtain.id)]);
    const original = quote.financialItems[0];

    quote.applyPatch({ financialItems: [{ id: original.id, quantity: 3 }] });

    expect(quote.financialItems).toHaveLength(1);
    expect(quote.financialItems[0]).toBe(original);
    expect(original.quantity).toBe(3);
  });

  it('creates associated and general items without IDs', () => {
    const curtain = Curtain.create({ room: 'Sala' });
    const quote = quoteWith([curtain]);

    quote.applyPatch({
      financialItems: [
        {
          name: 'Tecido',
          curtainId: curtain.id,
          quantity: 2,
          unitPriceCents: 1_000,
        },
        { name: 'Frete', curtainId: null, quantity: 1, unitPriceCents: 500 },
      ],
    });

    expect(quote.financialItems).toHaveLength(2);
    expect(quote.financialItemsForCurtain(curtain.id)[0].name).toBe('Tecido');
    expect(quote.generalFinancialItems[0].name).toBe('Frete');
    expect(
      quote.financialItems.every((entry) => entry.quoteId === quote.id),
    ).toBe(true);
  });

  it('moves an item between curtains and back to the general composition', () => {
    const first = Curtain.create({ room: 'Sala' });
    const second = Curtain.create({ room: 'Quarto' });
    const quote = quoteWith([first, second], [item('Tecido', first.id)]);
    const original = quote.financialItems[0];

    quote.applyPatch({
      financialItems: [{ id: original.id, curtainId: second.id }],
    });
    expect(quote.financialItemsForCurtain(second.id)[0]).toBe(original);
    expect(quote.financialItemsForCurtain(first.id)).toEqual([]);

    quote.applyPatch({
      financialItems: [{ id: original.id, curtainId: null }],
    });
    expect(quote.generalFinancialItems[0]).toBe(original);
  });

  it('removes items for deleted curtains when financialItems is omitted', () => {
    const removed = Curtain.create({ room: 'Sala' });
    const retained = Curtain.create({ room: 'Quarto' });
    const quote = quoteWith(
      [removed, retained],
      [
        item('Tecido', removed.id),
        item('Trilho', retained.id),
        item('Frete', null),
      ],
    );
    const retainedItemId = quote.financialItems.find(
      (entry) => entry.curtainId === retained.id,
    )!.id;
    const generalItemId = quote.generalFinancialItems[0].id;

    quote.applyPatch({ curtains: [{ id: retained.id }] });

    expect(quote.financialItems.map((entry) => entry.id)).toEqual([
      retainedItemId,
      generalItemId,
    ]);
  });

  it('accepts a final collection that omits items of removed curtains', () => {
    const removed = Curtain.create({ room: 'Sala' });
    const retained = Curtain.create({ room: 'Quarto' });
    const quote = quoteWith(
      [removed, retained],
      [item('Tecido', removed.id), item('Trilho', retained.id)],
    );
    const retainedItem = quote.financialItems.find(
      (entry) => entry.curtainId === retained.id,
    )!;

    quote.applyPatch({
      curtains: [{ id: retained.id }],
      financialItems: [{ id: retainedItem.id }],
    });

    expect(quote.financialItems).toEqual([retainedItem]);
  });

  it('rejects a reference to a curtain removed in the same patch before mutation', () => {
    const removed = Curtain.create({ room: 'Sala' });
    const retained = Curtain.create({ room: 'Quarto' });
    const original = item('Tecido', removed.id);
    const quote = quoteWith([removed, retained], [original]);
    const currentCurtains = quote.curtains;
    const currentItems = quote.financialItems;

    expect(() =>
      quote.applyPatch({
        notes: 'must not apply',
        curtains: [{ id: retained.id }],
        financialItems: [{ id: original.id }],
      }),
    ).toThrow(UnknownQuoteItemError);

    expect(quote.notes).toBeNull();
    expect(quote.curtains).toBe(currentCurtains);
    expect(quote.financialItems).toBe(currentItems);
    expect(original.curtainId).toBe(removed.id);
  });

  it('rejects invalid and foreign curtain associations before mutation', () => {
    const curtain = Curtain.create({ room: 'Sala' });
    const original = item('Tecido', curtain.id);
    const quote = quoteWith([curtain], [original]);
    const foreignCurtain = Curtain.create({ room: 'Outro orçamento' });

    for (const curtainId of ['unknown-curtain', foreignCurtain.id]) {
      expect(() =>
        quote.applyPatch({
          notes: 'must not apply',
          financialItems: [{ id: original.id, curtainId }],
        }),
      ).toThrow(UnknownQuoteItemError);
      expect(quote.notes).toBeNull();
      expect(original.curtainId).toBe(curtain.id);
    }
  });

  it('rejects unknown or repeated item IDs as unknown', () => {
    const first = item('Tecido', null);
    const second = item('Frete', null);
    const quote = quoteWith([], [first, second]);

    expect(() =>
      quote.applyPatch({ financialItems: [{ id: 'not-in-this-quote' }] }),
    ).toThrow(UnknownQuoteItemError);
    expect(() =>
      quote.applyPatch({
        financialItems: [{ id: first.id }, { id: first.id }],
      }),
    ).toThrow(UnknownQuoteItemError);
    expect(quote.financialItems).toHaveLength(2);
  });

  it('rejects IDs belonging to a different quote without looking up that quote', () => {
    const foreignQuote = quoteWith([], [item('Other quote', null)]);
    const quote = quoteWith([], [item('Local', null)]);
    const foreignId = foreignQuote.financialItems[0].id;

    expect(() =>
      quote.applyPatch({ financialItems: [{ id: foreignId }] }),
    ).toThrow(UnknownQuoteItemError);
  });

  it('does not mutate existing items when another patch item has invalid values', () => {
    const quote = quoteWith([], [item('Tecido', null, 1)]);
    const first = quote.financialItems[0];

    expect(() =>
      quote.applyPatch({
        financialItems: [
          { id: first.id, quantity: 5 },
          { name: 'Invalid', quantity: 0 },
        ],
      }),
    ).toThrow(RangeError);

    expect(first.quantity).toBe(1);
    expect(quote.financialItems).toEqual([first]);
  });

  it('allows edits in DRAFT and SENT and blocks other statuses', () => {
    quoteWithStatus(QuoteStatus.DRAFT).applyPatch({ notes: 'Draft' });
    quoteWithStatus(QuoteStatus.SENT).applyPatch({ notes: 'Sent' });
    expect(() =>
      quoteWithStatus(QuoteStatus.CONFIRMED).applyPatch({ notes: 'No' }),
    ).toThrow(QuoteNotEditableError);
  });

  it('creates a curtain and its items atomically through clientRef/curtainRef', () => {
    const quote = quoteWithStatus(QuoteStatus.DRAFT);

    quote.applyPatch({
      curtains: [
        ...quote.curtains.map((curtain) => ({ id: curtain.id })),
        { room: 'Cozinha', clientRef: 'cozinha' },
      ],
      financialItems: [
        ...quote.financialItems.map((existing) => ({ id: existing.id })),
        {
          name: 'Tecido',
          quantity: 2,
          unitPriceCents: 1_500,
          curtainRef: 'cozinha',
        },
      ],
    });

    const created = quote.curtains.find(
      (curtain) => curtain.room === 'Cozinha',
    );

    expect(created).toBeDefined();
    expect(quote.financialItemsForCurtain(created!.id)).toHaveLength(1);
    expect(quote.financialItemsForCurtain(created!.id)[0].name).toBe('Tecido');
  });

  it('allows adding a complete curtain to a SENT quote', () => {
    const quote = quoteWithStatus(QuoteStatus.SENT);

    expect(() =>
      quote.applyPatch({
        curtains: [
          ...quote.curtains.map((curtain) => ({ id: curtain.id })),
          {
            room: 'Cozinha',
            material: 'Linho',
            openingWidth: 1.5,
            height: 2,
            clientRef: 'cozinha',
          },
        ],
        financialItems: [
          ...quote.financialItems.map((existing) => ({ id: existing.id })),
          {
            name: 'Tecido',
            quantity: 2,
            unitPriceCents: 1_500,
            curtainRef: 'cozinha',
          },
        ],
      }),
    ).not.toThrow();
    expect(quote.curtains).toHaveLength(2);
  });

  it('rejects a curtain added to a SENT quote without a complete item', () => {
    const quote = quoteWithStatus(QuoteStatus.SENT);

    expect(() =>
      quote.applyPatch({
        curtains: [
          ...quote.curtains.map((curtain) => ({ id: curtain.id })),
          { room: 'Cozinha' },
        ],
      }),
    ).toThrow(QuoteValidationError);
    expect(quote.curtains).toHaveLength(1);
  });

  it('rejects unknown, duplicated or misplaced creation refs without mutating', () => {
    const quote = quoteWithStatus(QuoteStatus.DRAFT);
    const originalCurtains = quote.curtains;
    const existingCurtains = quote.curtains.map((curtain) => ({
      id: curtain.id,
    }));
    const existingItems = quote.financialItems.map((existing) => ({
      id: existing.id,
    }));

    expect(() =>
      quote.applyPatch({
        financialItems: [
          ...existingItems,
          { name: 'X', curtainRef: 'missing' },
        ],
      }),
    ).toThrow(UnknownQuoteItemError);
    expect(() =>
      quote.applyPatch({
        curtains: [
          ...existingCurtains,
          { room: 'A', clientRef: 'r' },
          { room: 'B', clientRef: 'r' },
        ],
      }),
    ).toThrow(UnknownQuoteItemError);
    expect(() =>
      quote.applyPatch({
        curtains: [
          ...existingCurtains,
          { id: quote.curtains[0].id, clientRef: 'r' },
        ],
      }),
    ).toThrow(UnknownQuoteItemError);
    expect(() =>
      quote.applyPatch({
        financialItems: [
          ...existingItems,
          { id: quote.financialItems[0].id, curtainRef: 'r' },
        ],
      }),
    ).toThrow(UnknownQuoteItemError);
    expect(() =>
      quote.applyPatch({
        curtains: [...existingCurtains, { room: 'A', clientRef: 'r' }],
        financialItems: [
          ...existingItems,
          { name: 'X', curtainRef: 'r', curtainId: null },
        ],
      }),
    ).toThrow(UnknownQuoteItemError);

    expect(quote.curtains).toBe(originalCurtains);
  });

  it('preserves the SENT quote validation gate', () => {
    const quote = quoteWithStatus(QuoteStatus.SENT);
    const financialItem = quote.financialItems[0];
    expect(() =>
      quote.applyPatch({ notes: 'must not apply', financialItems: [] }),
    ).toThrow(QuoteValidationError);
    expect(quote.notes).toBeNull();
    expect(quote.financialItems[0]).toBe(financialItem);
  });

  it('does not apply a patch whose derived total leaves the supported range', () => {
    const quote = quoteWith([], [item('Item', null, 1, 1)]);
    const financialItem = quote.financialItems[0];

    expect(() =>
      quote.applyPatch({
        notes: 'must not apply',
        financialItems: [
          {
            id: financialItem.id,
            quantity: 999_999,
            unitPriceCents: 2_147_483_647,
          },
        ],
      }),
    ).toThrow(QuoteValidationError);

    expect(quote.notes).toBeNull();
    expect(quote.financialItems[0]).toBe(financialItem);
    expect(financialItem.quantity).toBe(1);
  });
});
